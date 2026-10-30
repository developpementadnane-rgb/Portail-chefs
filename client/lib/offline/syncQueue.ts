/**
 * Attendance sync queue — the client half of the idempotent sync
 * strategy described in server/routes/attendance.ts's /sync handler.
 *
 * Lifecycle of one attendance action taken offline:
 *   1. queueAttendance() writes it to IndexedDB's attendanceQueue
 *      store immediately, keyed by a freshly-generated client_op_id.
 *      It ALSO writes to attendanceCache so the UI can reflect
 *      "marked present" instantly, before any sync happens.
 *   2. Whenever the app detects it's online (see useOnlineStatus
 *      hook + the 'online' window event), flushQueue() is called.
 *   3. flushQueue() reads the entire queue, sorts by
 *      client_recorded_at (oldest first — this ordering matters for
 *      how the server resolves same-batch conflicts, see the server
 *      route's comment on sequential processing), and POSTs it as one
 *      batch to /api/attendance/sync.
 *   4. On a successful response, each operation's outcome
 *      (accepted/duplicate/superseded/error) is applied:
 *        - accepted / duplicate → remove from the local queue, the
 *          action is durably recorded server-side (duplicate just
 *          means it already was, from an earlier attempt).
 *        - superseded → remove from the local queue AND refresh the
 *          local cache entry from the server's version, so this
 *          device's UI stops showing its own losing value.
 *        - error → LEAVE in the queue for the next flush attempt.
 *          Transient errors (a flaky reconnect) shouldn't lose data.
 *   5. If the network call itself fails (not even a response),
 *      nothing is removed from the queue — same outcome as 'error'.
 *
 * This module deliberately does not retry with backoff internally;
 * it's called opportunistically (on reconnect, on app foreground, on
 * a manual "sync now" action) rather than polling, which matches the
 * strategy doc's "Internet retrouvé → synchronisation automatique"
 * framing without adding a background timer that would itself drain
 * battery during a camp.
 */

import { idbGetAll, idbPut, idbDelete, idbReplaceAll, STORES } from "./db";
import { getOrCreateDeviceId } from "./deviceTrust";
import { getOfflineAuthHeaders, getOfflineChefId } from "./accessMode";
import { getAuthHeaders } from "../api";
import { API_BASE_URL } from "../apiConfig";

export type AttendanceStatus = "present" | "absent" | "excused";
export type RecordedVia = "chef_manual" | "qr_pin_checkin" | "chef_badge_scan";

export interface QueuedAttendanceOp {
  client_op_id: string;
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  recorded_via: RecordedVia;
  client_recorded_at: string; // ISO 8601, set at queue time — see note above on why this drives conflict resolution, not synced_at
  notes?: string;
  /** Local-only bookkeeping, never sent to the server. */
  queued_at: string;
  attempt_count: number;
}

export interface AttendanceCacheEntry {
  key: string; // `${session_id}:${member_id}`
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  client_recorded_at: string;
  source: "server" | "local_pending";
}

function cacheKey(sessionId: string, memberId: string): string {
  return `${sessionId}:${memberId}`;
}

/**
 * Queue an attendance action. Safe to call offline or online — it
 * always writes locally first; syncing is a separate, later step.
 * Returns the queued operation's client_op_id, useful if the caller
 * wants to show a per-action pending indicator.
 */
export async function queueAttendance(input: {
  sessionId: string;
  memberId: string;
  status: AttendanceStatus;
  recordedVia?: RecordedVia;
  notes?: string;
}): Promise<string> {
  const clientOpId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const now = new Date().toISOString();

  const op: QueuedAttendanceOp = {
    client_op_id: clientOpId,
    session_id: input.sessionId,
    member_id: input.memberId,
    status: input.status,
    recorded_via: input.recordedVia ?? "chef_manual",
    client_recorded_at: now,
    notes: input.notes,
    queued_at: now,
    attempt_count: 0,
  };

  await idbPut(STORES.attendanceQueue, op);

  // Optimistic local cache update so the UI reflects this
  // immediately, before any sync round-trip.
  await idbPut<AttendanceCacheEntry>(STORES.attendanceCache, {
    key: cacheKey(input.sessionId, input.memberId),
    session_id: input.sessionId,
    member_id: input.memberId,
    status: input.status,
    client_recorded_at: now,
    source: "local_pending",
  });

  return clientOpId;
}

export async function getQueueLength(): Promise<number> {
  const all = await idbGetAll<QueuedAttendanceOp>(STORES.attendanceQueue);
  return all.length;
}

export async function getCachedAttendanceForSession(
  sessionId: string,
): Promise<AttendanceCacheEntry[]> {
  const all = await idbGetAll<AttendanceCacheEntry>(STORES.attendanceCache);
  return all.filter((entry) => entry.session_id === sessionId);
}

interface SyncOpResult {
  client_op_id: string;
  outcome: "accepted" | "duplicate" | "superseded" | "error";
  server_id?: string;
  reason?: string;
}

interface SyncResponse {
  results: SyncOpResult[];
  summary: { accepted: number; duplicates: number; conflicts: number };
}

export interface FlushSummary {
  attempted: number;
  accepted: number;
  duplicates: number;
  superseded: number;
  errors: number;
  networkFailure: boolean;
}

/**
 * Sends the entire local queue to the server in one batch and
 * reconciles the result. Safe to call repeatedly / opportunistically —
 * an empty queue is a no-op, and a queue that partially fails simply
 * keeps the failed portion for next time.
 */
export async function flushQueue(): Promise<FlushSummary> {
  const queued = await idbGetAll<QueuedAttendanceOp>(STORES.attendanceQueue);

  if (queued.length === 0) {
    return { attempted: 0, accepted: 0, duplicates: 0, superseded: 0, errors: 0, networkFailure: false };
  }

  // Oldest client_recorded_at first — see module docstring on why
  // this ordering matters for same-batch conflict resolution.
  const sorted = [...queued].sort(
    (a, b) => new Date(a.client_recorded_at).getTime() - new Date(b.client_recorded_at).getTime(),
  );

  const deviceId = await getOrCreateDeviceId();

  // Two independent auth layers are combined here, both optional and
  // additive: getAuthHeaders() sends the normal short-lived session
  // JWT if one happens to still be valid (Authorization: Bearer …),
  // while getOfflineAuthHeaders() sends whichever offline mechanism
  // is active — a personal device token (X-Device-Token) or the
  // shared team token (X-Team-Token) — see
  // server/middleware/requireOfflineAccess.ts, which tries the JWT
  // first and falls back to whichever offline header is present.
  // This means a device with an EXPIRED JWT but valid device trust
  // (the exact situation after several offline days) still
  // authenticates successfully without the user re-entering
  // CIN/password.
  const offlineHeaders = await getOfflineAuthHeaders();
  const offlineChefId = await getOfflineChefId();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/attendance/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...offlineHeaders,
      },
      body: JSON.stringify({
        device_id: deviceId,
        ...(offlineChefId ? { chef_id: offlineChefId } : {}),
        operations: sorted.map((op) => ({
          client_op_id: op.client_op_id,
          session_id: op.session_id,
          member_id: op.member_id,
          status: op.status,
          recorded_via: op.recorded_via,
          client_recorded_at: op.client_recorded_at,
          notes: op.notes,
        })),
      }),
    });
  } catch {
    // Network unreachable — leave the entire queue intact for the
    // next opportunity. Bump attempt_count for observability.
    await Promise.all(
      sorted.map((op) =>
        idbPut(STORES.attendanceQueue, { ...op, attempt_count: op.attempt_count + 1 }),
      ),
    );
    return {
      attempted: sorted.length,
      accepted: 0,
      duplicates: 0,
      superseded: 0,
      errors: 0,
      networkFailure: true,
    };
  }

  if (!response.ok) {
    await Promise.all(
      sorted.map((op) =>
        idbPut(STORES.attendanceQueue, { ...op, attempt_count: op.attempt_count + 1 }),
      ),
    );
    return {
      attempted: sorted.length,
      accepted: 0,
      duplicates: 0,
      superseded: 0,
      errors: sorted.length,
      networkFailure: false,
    };
  }

  const body: SyncResponse = await response.json();
  const resultByOpId = new Map(body.results.map((r) => [r.client_op_id, r]));

  let accepted = 0;
  let duplicates = 0;
  let superseded = 0;
  let errors = 0;

  for (const op of sorted) {
    const result = resultByOpId.get(op.client_op_id);

    if (!result || result.outcome === "error") {
      errors += 1;
      await idbPut(STORES.attendanceQueue, { ...op, attempt_count: op.attempt_count + 1 });
      continue;
    }

    // accepted / duplicate / superseded are all terminal from this
    // device's point of view — the queue entry is done.
    await idbDelete(STORES.attendanceQueue, op.client_op_id);

    if (result.outcome === "accepted") {
      accepted += 1;
      await idbPut<AttendanceCacheEntry>(STORES.attendanceCache, {
        key: cacheKey(op.session_id, op.member_id),
        session_id: op.session_id,
        member_id: op.member_id,
        status: op.status,
        client_recorded_at: op.client_recorded_at,
        source: "server",
      });
    } else if (result.outcome === "duplicate") {
      duplicates += 1;
      // Already reflected locally from when it was first queued;
      // just mark the cache entry as server-confirmed.
      await idbPut<AttendanceCacheEntry>(STORES.attendanceCache, {
        key: cacheKey(op.session_id, op.member_id),
        session_id: op.session_id,
        member_id: op.member_id,
        status: op.status,
        client_recorded_at: op.client_recorded_at,
        source: "server",
      });
    } else if (result.outcome === "superseded") {
      superseded += 1;
      // This device's value lost to a newer record from elsewhere.
      // Refresh from the server so the UI shows the true value rather
      // than this device's stale local_pending entry.
      await refreshAttendanceCacheForSession(op.session_id);
    }
  }

  return { attempted: sorted.length, accepted, duplicates, superseded, errors, networkFailure: false };
}

/**
 * Re-downloads the authoritative attendance state for one session
 * and replaces the local cache entries for it. Called after a
 * 'superseded' outcome, and can also be called proactively when
 * opening a session screen while online.
 */
export async function refreshAttendanceCacheForSession(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/attendance/for-session/${sessionId}`, {
      headers: { ...getAuthHeaders(), ...(await getOfflineAuthHeaders()) },
    });
    if (!response.ok) return;

    const body: {
      records: Array<{
        session_id: string;
        member_id: string;
        status: AttendanceStatus;
        client_recorded_at: string;
      }>;
    } = await response.json();

    const existing = await idbGetAll<AttendanceCacheEntry>(STORES.attendanceCache);
    const otherSessions = existing.filter((entry) => entry.session_id !== sessionId);

    const refreshed: AttendanceCacheEntry[] = body.records.map((record) => ({
      key: cacheKey(record.session_id, record.member_id),
      session_id: record.session_id,
      member_id: record.member_id,
      status: record.status,
      client_recorded_at: record.client_recorded_at,
      source: "server",
    }));

    await idbReplaceAll(STORES.attendanceCache, [...otherSessions, ...refreshed]);
  } catch (error) {
    console.warn("[offline] Could not refresh attendance cache for session:", sessionId, error);
  }
}
