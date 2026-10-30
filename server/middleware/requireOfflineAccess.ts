import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { verifyDeviceToken } from "../lib/deviceTrust";

// Hardcoded field-access key. Same value as the client's
// client/lib/offline/teamAccess.ts. Deliberately a plain constant
// with no rotation and no server round-trip needed to check it: the
// entire point is that a chef in the field with zero connectivity can
// unlock the two offline-capable screens (members, badge scan)
// without ever reaching the server, and later push queued attendance
// using this same fixed value once the device reconnects.
const FIELD_ACCESS_KEY = "SHM-hH45-n1Cj-rXae-FNTh";

declare global {
  namespace Express {
    interface Request {
      /** Set when the request is authenticated as a specific chef, via
       *  either a normal session JWT or a personal device token. NOT
       *  set for team-passphrase requests — see auth_mode below. */
      user_id?: string;
      /** Which of the three trust mechanisms authenticated this
       *  request. Routes that need to know "was this an individually
       *  identified chef or the shared team passphrase" (e.g. to set
       *  attendance_records.recorded_via_team_token) read this rather
       *  than inferring it from whether user_id is set, since that
       *  inference would break if a fourth mode is ever added. */
      auth_mode?: "session_jwt" | "personal_device_token" | "team_token";
      /** Present for personal_device_token and team_token modes — the
       *  client-generated device identifier, useful for
       *  recorded_by_device_id / attendance_sync_log. */
      device_id?: string;
    }
  }
}

/**
 * Broader than requireAuth: accepts any of the three offline-eligible
 * trust mechanisms, in this priority order —
 *   1. Authorization: Bearer <session JWT>   (normal online login)
 *   2. X-Device-Token + X-Device-Id           (personal device trust,
 *                                               10 days, tied to a chef)
 *   3. X-Field-Key + X-Device-Id              (hardcoded shared key,
 *                                               no individual chef identity)
 *
 * Use this ONLY for the narrow surface the offline strategy actually
 * needs offline: reading cached member/session data server-side (if
 * ever needed) and POSTing attendance sync/check-in batches. Every
 * other route (creating sessions, managing chef accounts, reports,
 * ideas, the QR/PIN challenge-creation endpoint itself) stays on
 * requireAuth exactly as before — a team token or a personal device
 * token can NEVER satisfy requireAuth, only requireOfflineAccess. This
 * is what keeps "a device with the shared passphrase" from ever being
 * able to do anything beyond attendance sync, by construction rather
 * than by remembering to check auth_mode in every other route.
 */
export async function requireOfflineAccess(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const jwtSecret = process.env.JWT_SECRET;

  if (jwtSecret && authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    try {
      const payload = jwt.verify(token, jwtSecret);
      if (typeof payload === "object" && typeof payload.user_id === "string" && payload.user_id) {
        req.user_id = payload.user_id;
        req.auth_mode = "session_jwt";
        return next();
      }
    } catch {
      // Fall through to the other mechanisms rather than failing
      // immediately — an expired JWT is exactly the situation a
      // device coming back online after 10 offline days is in, and
      // it may still have a valid personal device token to fall back
      // on.
    }
  }

  const deviceId = req.header("x-device-id");
  const personalDeviceToken = req.header("x-device-token");
  const fieldKey = req.header("x-field-key");
  // POST routes (e.g. /attendance/sync) send chef_id in the body.
  // GET routes (e.g. /attendance/relevant-sessions) have no body, so
  // the client sends it as a query param instead -- accept either.
  const chefIdInput = req.body?.chef_id ?? req.query?.chef_id;

  if (deviceId && personalDeviceToken && chefIdInput) {
    const chefId = String(chefIdInput);
    const result = await verifyDeviceToken(personalDeviceToken, chefId, deviceId);
    if (result.valid) {
      req.user_id = chefId;
      req.auth_mode = "personal_device_token";
      req.device_id = deviceId;
      return next();
    }
  }

  if (deviceId && fieldKey && fieldKey === FIELD_ACCESS_KEY) {
    req.auth_mode = "team_token";
    req.device_id = deviceId;
    // Deliberately no req.user_id: this is the whole point of the
    // shared field key. Routes must handle user_id being undefined
    // here (server/routes/attendance.ts's /sync does).
    return next();
  }

  return res.status(401).json({ error: "Authentication required" });
}
