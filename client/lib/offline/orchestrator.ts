/**
 * Central offline orchestrator. This is the one module pages should
 * import from for "make sure offline data is fresh / synced" rather
 * than each page independently deciding when to download or flush.
 *
 * Two entry points:
 *   - runInitialSync(): called once after a successful online login
 *     (see Login.tsx). Downloads members + relevant sessions, then
 *     flushes any leftover queue from a previous offline session
 *     (e.g. the chef logged in on day 1, worked offline, and is only
 *     now getting a fresh online moment).
 *   - runReconnectSync(): called whenever the app detects it came
 *     back online mid-session (window 'online' event). Flushes the
 *     attendance queue and opportunistically refreshes members +
 *     sessions if they're due (see membersCache/sessionsCache "last
 *     synced" helpers) — but does NOT force a full members download
 *     on every reconnect blip, since that would be wasteful on a
 *     flaky connection reconnecting repeatedly.
 */

import { downloadMembersForOffline, getMembersLastSyncedAt } from "./membersCache";
import { downloadRelevantSessionsForOffline, getSessionsLastSyncedAt } from "./sessionsCache";
import { flushQueue, type FlushSummary } from "./syncQueue";

const REFRESH_IF_OLDER_THAN_MS = 60 * 60 * 1000; // 1 hour

export interface InitialSyncResult {
  members: { count: number; error: string | null };
  sessions: { count: number; error: string | null };
  flush: FlushSummary;
}

export async function runInitialSync(): Promise<InitialSyncResult> {
  const [members, sessions] = await Promise.all([
    downloadMembersForOffline(),
    downloadRelevantSessionsForOffline(),
  ]);

  const flush = await flushQueue();

  return { members, sessions, flush };
}

export interface ReconnectSyncResult {
  flush: FlushSummary;
  membersRefreshed: boolean;
  sessionsRefreshed: boolean;
}

export async function runReconnectSync(): Promise<ReconnectSyncResult> {
  // Attendance first: getting queued presence data safely persisted
  // is the priority the moment connectivity returns, ahead of
  // refreshing read caches.
  const flush = await flushQueue();

  const [membersLastSynced, sessionsLastSynced] = await Promise.all([
    getMembersLastSyncedAt(),
    getSessionsLastSyncedAt(),
  ]);

  const now = Date.now();
  const membersStale =
    !membersLastSynced || now - membersLastSynced.getTime() > REFRESH_IF_OLDER_THAN_MS;
  const sessionsStale =
    !sessionsLastSynced || now - sessionsLastSynced.getTime() > REFRESH_IF_OLDER_THAN_MS;

  let membersRefreshed = false;
  let sessionsRefreshed = false;

  if (membersStale) {
    const result = await downloadMembersForOffline();
    membersRefreshed = !result.error;
  }
  if (sessionsStale) {
    const result = await downloadRelevantSessionsForOffline();
    sessionsRefreshed = !result.error;
  }

  return { flush, membersRefreshed, sessionsRefreshed };
}
