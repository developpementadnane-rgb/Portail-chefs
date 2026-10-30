import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireOfflineAccess } from "../middleware/requireOfflineAccess";
import { getServerSupabase } from "../lib/supabase";

const router = Router();
// How far in the past a session's date_time may be while still being
// worth downloading for offline use — see GET /relevant-sessions.
// Sessions don't have an explicit end time (see client/pages/Sessions.tsx),
// so this margin covers a session still being checked into shortly
// after its nominal start.
const SESSION_PAST_RELEVANCE_MS = 24 * 60 * 60 * 1000; // 1 day


/**
 * GET /api/attendance/relevant-sessions?days=10
 *
 * Returns the sessions worth caching for offline use: those whose
 * date_time falls within the device's trust window. Uses
 * requireOfflineAccess (not requireAuth) so a device relying on
 * personal device-trust or the shared team passphrase — not just a
 * live session JWT — can refresh this cache the moment it reconnects,
 * without forcing a full CIN/password re-login first.
 */
router.get("/relevant-sessions", requireOfflineAccess, async (req, res) => {
  const daysParam = typeof req.query.days === "string" ? Number(req.query.days) : 10;
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 30) : 10;

  try {
    const supabase = getServerSupabase();
    const now = Date.now();
    const windowStart = new Date(now - SESSION_PAST_RELEVANCE_MS).toISOString();
    const windowEnd = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

    // date_time can be null for some older/manually-inserted rows
    // (see the date_time || created_at fallback already used for
    // display in client/pages/Sessions.tsx). A plain .gte()/.lte()
    // on date_time silently excludes every such row from the offline
    // cache, so this is fetched as two queries -- dated sessions
    // within the window, plus undated sessions filtered by
    // created_at instead -- and merged.
    const [datedResult, undatedResult] = await Promise.all([
      supabase
        .from("sessions")
        .select(
          "id, title, date_time, location, target_audience, objective, methodology, created_at",
        )
        .not("date_time", "is", null)
        .gte("date_time", windowStart)
        .lte("date_time", windowEnd),
      supabase
        .from("sessions")
        .select(
          "id, title, date_time, location, target_audience, objective, methodology, created_at",
        )
        .is("date_time", null)
        .gte("created_at", windowStart)
        .lte("created_at", windowEnd),
    ]);

    if (datedResult.error) {
      console.error("Failed to load relevant sessions:", datedResult.error);
      return res.status(500).json({ error: "Unable to load sessions" });
    }
    if (undatedResult.error) {
      console.error("Failed to load relevant undated sessions:", undatedResult.error);
      return res.status(500).json({ error: "Unable to load sessions" });
    }

    const sessions = [...(datedResult.data ?? []), ...(undatedResult.data ?? [])].sort(
      (a, b) =>
        new Date(a.date_time ?? a.created_at).getTime() -
        new Date(b.date_time ?? b.created_at).getTime(),
    );

    return res.json({ sessions });
  } catch (error) {
    console.error("Relevant sessions error:", error);
    return res.status(500).json({ error: "Unable to load sessions" });
  }
});

const attendanceOpSchema = z.object({
  client_op_id: z.string().uuid(),
  session_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: z.enum(["present", "absent", "excused"]),
  recorded_via: z.enum(["chef_manual", "qr_pin_checkin", "chef_badge_scan"]).default("chef_manual"),
  client_recorded_at: z.string().datetime({ offset: true }),
  notes: z.string().max(2000).optional(),
});

const syncBatchSchema = z.object({
  // Required for requireOfflineAccess's personal-device-token path
  // (see server/middleware/requireOfflineAccess.ts) — ignored when
  // the request instead authenticates via a session JWT or a team
  // token, both of which don't need it repeated in the body.
  chef_id: z.string().uuid().optional(),
  device_id: z.string().max(200).optional(),
  operations: z.array(attendanceOpSchema).min(1).max(500),
});

/**
 * POST /api/attendance/sync
 *
 * The offline sync endpoint. Accepts a BATCH of attendance
 * operations queued locally (client/lib/offline/syncQueue.ts) rather
 * than one call per record, because a device coming back online
 * after several offline days may have dozens of queued actions and
 * this must not mean dozens of round-trips.
 *
 * Authenticated via requireOfflineAccess: a session JWT, a personal
 * device token, OR the shared team passphrase's token all work here.
 * req.user_id is therefore OPTIONAL in this handler — a team-token
 * request has no individual chef identity by design (see
 * server/lib/deviceTrust.ts's section on team access), and every
 * write below handles that null explicitly rather than assuming a
 * chef is always present.
 *
 * Idempotency: each operation carries a client-generated client_op_id
 * (a UUID minted the moment the chef tapped "present", before any
 * network attempt). Re-sending the same operation — because the
 * first sync attempt's response was lost, or because the queue was
 * retried — must never create a duplicate attendance_records row.
 * This endpoint upserts on client_op_id to guarantee that.
 *
 * Conflict resolution: attendance_records also has a UNIQUE
 * (session_id, member_id) constraint — at most one attendance fact
 * per member per session. Two different devices (two client_op_ids)
 * can legitimately both claim "I recorded member M's attendance for
 * session S" if, per the strategy doc, one chef marks a member
 * present while offline and that member's own QR check-in (via the
 * separate members portal) also lands independently. When both
 * arrive, whichever has the LATER client_recorded_at wins — the
 * actual moment the action happened on-device, not the moment it
 * happened to reach the server (synced_at), since a device can stay
 * offline far longer than another. Ties (identical timestamps, or a
 * losing update) are recorded in attendance_sync_log for audit but
 * never silently dropped from the response the device sees.
 */
router.post("/sync", requireOfflineAccess, async (req, res) => {
  const parsed = syncBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid sync batch",
      details: parsed.error.flatten(),
    });
  }

  const { device_id: deviceId, operations } = parsed.data;
  const isTeamToken = req.auth_mode === "team_token";
  const supabase = getServerSupabase();

  const results: Array<{
    client_op_id: string;
    outcome: "accepted" | "duplicate" | "superseded" | "error";
    server_id?: string;
    reason?: string;
  }> = [];

  let acceptedCount = 0;
  let duplicateCount = 0;
  let conflictCount = 0;

  // Sequential, not Promise.all: operations may target the same
  // (session_id, member_id) pair within one batch (e.g. a chef
  // corrected their own mistake twice while offline), and processing
  // them in client_recorded_at order — which the client sorts before
  // sending, see syncQueue.ts — keeps the "last write wins" rule
  // correct even within a single batch, not just across batches.
  for (const op of operations) {
    try {
      // Has this exact client_op_id been synced before? (retry of a
      // batch whose response was lost in transit)
      const { data: existingByOpId } = await supabase
        .from("attendance_records")
        .select("id, client_op_id")
        .eq("client_op_id", op.client_op_id)
        .maybeSingle();

      if (existingByOpId) {
        results.push({
          client_op_id: op.client_op_id,
          outcome: "duplicate",
          server_id: existingByOpId.id,
        });
        duplicateCount += 1;
        continue;
      }

      // Is there already a different attendance fact for this
      // (session, member) pair, recorded by a different client_op_id
      // (i.e. a different device/action)?
      const { data: existingForPair } = await supabase
        .from("attendance_records")
        .select("id, client_op_id, client_recorded_at")
        .eq("session_id", op.session_id)
        .eq("member_id", op.member_id)
        .maybeSingle();

      if (existingForPair) {
        const existingTime = new Date(existingForPair.client_recorded_at).getTime();
        const incomingTime = new Date(op.client_recorded_at).getTime();

        if (incomingTime <= existingTime) {
          // Existing record is same-age-or-newer: keep it, log the
          // conflict, but still report a clear outcome to the device
          // (not silence — the chef's UI can show "already recorded
          // by another device" rather than assuming success).
          conflictCount += 1;
          results.push({
            client_op_id: op.client_op_id,
            outcome: "superseded",
            server_id: existingForPair.id,
            reason: "A newer or equally-recent record already exists for this member/session",
          });
          continue;
        }

        // Incoming operation is strictly newer: it wins. Update in
        // place rather than inserting a second row, since
        // (session_id, member_id) is UNIQUE.
        const { data: updated, error: updateError } = await supabase
          .from("attendance_records")
          .update({
            client_op_id: op.client_op_id,
            status: op.status,
            recorded_by_chef_id: req.user_id ?? null,
            recorded_by_device_id: deviceId ?? req.device_id ?? null,
            recorded_via_team_token: isTeamToken,
            recorded_via: op.recorded_via,
            client_recorded_at: op.client_recorded_at,
            synced_at: new Date().toISOString(),
            notes: op.notes ?? null,
          })
          .eq("id", existingForPair.id)
          .select("id")
          .single();

        if (updateError || !updated) {
          console.error("Failed to update superseding attendance record:", updateError);
          results.push({ client_op_id: op.client_op_id, outcome: "error", reason: "update_failed" });
          continue;
        }

        conflictCount += 1;
        acceptedCount += 1;
        results.push({ client_op_id: op.client_op_id, outcome: "accepted", server_id: updated.id });
        continue;
      }

      // No prior record for this pair at all: plain insert.
      const { data: inserted, error: insertError } = await supabase
        .from("attendance_records")
        .insert({
          client_op_id: op.client_op_id,
          session_id: op.session_id,
          member_id: op.member_id,
          status: op.status,
          recorded_by_chef_id: req.user_id ?? null,
          recorded_by_device_id: deviceId ?? req.device_id ?? null,
          recorded_via_team_token: isTeamToken,
          recorded_via: op.recorded_via,
          client_recorded_at: op.client_recorded_at,
          notes: op.notes ?? null,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        // A concurrent request racing us could have inserted the same
        // (session_id, member_id) between our check and this insert;
        // the UNIQUE constraint turns that race into a clean 23505
        // rather than a duplicate row. Treat it as a conflict to
        // retry on the next sync rather than a hard error.
        if ((insertError as { code?: string } | null)?.code === "23505") {
          conflictCount += 1;
          results.push({
            client_op_id: op.client_op_id,
            outcome: "superseded",
            reason: "Concurrent write detected; will resolve on next sync",
          });
          continue;
        }
        console.error("Failed to insert attendance record:", insertError);
        results.push({ client_op_id: op.client_op_id, outcome: "error", reason: "insert_failed" });
        continue;
      }

      acceptedCount += 1;
      results.push({ client_op_id: op.client_op_id, outcome: "accepted", server_id: inserted.id });
    } catch (opError) {
      console.error("Attendance sync operation error:", opError);
      results.push({ client_op_id: op.client_op_id, outcome: "error", reason: "unexpected_error" });
    }
  }

  // Best-effort audit log; never fails the request.
  await supabase.from("attendance_sync_log").insert({
    chef_id: req.user_id ?? null,
    device_id: deviceId ?? req.device_id ?? null,
    used_team_token: isTeamToken,
    batch_size: operations.length,
    accepted_count: acceptedCount,
    duplicate_count: duplicateCount,
    conflict_count: conflictCount,
  });

  return res.status(200).json({ results, summary: { accepted: acceptedCount, duplicates: duplicateCount, conflicts: conflictCount } });
});

/**
 * GET /api/attendance/for-session/:sessionId
 * Current attendance facts for one session — used both by the normal
 * online UI and to refresh the client's attendanceCache after a
 * successful sync.
 */
router.get("/for-session/:sessionId", requireOfflineAccess, async (req, res) => {
  const sessionId = req.params.sessionId;
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, session_id, member_id, status, client_recorded_at, recorded_via, notes")
      .eq("session_id", sessionId);

    if (error) {
      console.error("Failed to load attendance for session:", error);
      return res.status(500).json({ error: "Unable to load attendance" });
    }

    return res.json({ records: data ?? [] });
  } catch (error) {
    console.error("Attendance for-session error:", error);
    return res.status(500).json({ error: "Unable to load attendance" });
  }
});

export default router;
