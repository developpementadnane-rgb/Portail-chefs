/**
 * Unifies the two independent offline trust mechanisms — personal
 * device trust (deviceTrust.ts, tied to a chef login) and the shared
 * team passphrase (teamAccess.ts, anonymous) — behind one surface, so
 * that pages (Members.tsx, Sessions.tsx, AttendanceChallenges.tsx)
 * and syncQueue.ts don't each need to know both mechanisms exist and
 * juggle them independently.
 *
 * Precedence when BOTH are present on one device (a chef who logged
 * in normally on a device that ALSO redeemed the team passphrase at
 * some point): personal device trust wins, because it carries a real
 * identity and everywhere that identity is useful (e.g. showing "Chef
 * Yassine" in the header) it should be preferred over anonymous
 * access. This only affects which auth headers get attached to
 * requests — both mechanisms grant the same offline data-access
 * capabilities otherwise.
 */

import { getCurrentChef } from "../authService";
import { isDeviceTrusted, getOrCreateDeviceId, getDeviceTrustToken } from "./deviceTrust";
import { hasFieldAccess, getFieldAccessHeaders } from "./teamAccess";

export type OfflineAccessMode = "personal_device" | "team_token" | "none";

/**
 * Determines which offline mechanism, if any, currently grants this
 * device access. Safe to call frequently — both underlying checks are
 * local reads, no network.
 */
export async function getOfflineAccessMode(): Promise<OfflineAccessMode> {
  const chef = getCurrentChef();
  if (chef && (await isDeviceTrusted(String(chef.id)))) {
    return "personal_device";
  }
  if (hasFieldAccess()) {
    return "team_token";
  }
  return "none";
}

export async function hasAnyOfflineAccess(): Promise<boolean> {
  const mode = await getOfflineAccessMode();
  return mode !== "none";
}

/**
 * Builds the extra headers a request needs to authenticate via
 * whichever offline mechanism is active, on top of (or instead of)
 * the normal Authorization: Bearer session JWT header from
 * client/lib/api.ts's getAuthHeaders(). Returns an empty object for
 * "none" — callers should already be falling back to an
 * online-required error path in that case, not silently sending an
 * unauthenticated request.
 */
export async function getOfflineAuthHeaders(): Promise<Record<string, string>> {
  const mode = await getOfflineAccessMode();
  const deviceId = await getOrCreateDeviceId();

  if (mode === "personal_device") {
    const token = await getDeviceTrustToken();
    if (!token) return {};
    return { "X-Device-Id": deviceId, "X-Device-Token": token };
  }

  if (mode === "team_token") {
    return { "X-Device-Id": deviceId, ...getFieldAccessHeaders() };
  }

  return {};
}

/**
 * The chef_id to include in a sync/check-in request body when in
 * personal_device mode. Returns null in every other mode (team_token
 * has no chef identity by design; "none" has nothing to send at all).
 */
export async function getOfflineChefId(): Promise<string | null> {
  const mode = await getOfflineAccessMode();
  if (mode !== "personal_device") return null;
  const chef = getCurrentChef();
  return chef ? String(chef.id) : null;
}
