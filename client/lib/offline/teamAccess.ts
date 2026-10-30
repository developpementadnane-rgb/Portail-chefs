/**
 * Field access key — hardcoded, zero-network verification.
 *
 * This exists for exactly one situation: no internet connection at
 * all, so a personal chef login (which needs Supabase) is not
 * possible. The key below is checked entirely on-device, with no
 * server call, since by definition there may be no network available
 * at the moment it's entered.
 *
 * Once accepted, this unlocks the two offline-capable screens
 * (member roster, badge attendance scan) using whatever is already
 * cached locally (membersCache.ts) and queues any scan locally
 * (syncQueue.ts). The SAME key is also hardcoded server-side
 * (server/middleware/requireOfflineAccess.ts) so that once the device
 * reconnects, the queued attendance can still be pushed to Supabase
 * using this key as the credential — no separate online step, no
 * token minting, no expiry.
 */

export const FIELD_ACCESS_KEY = "SHM-hH45-n1Cj-rXae-FNTh";

const STORAGE_KEY = "shm_field_access_unlocked";

export function unlockFieldAccess(enteredKey: string): boolean {
  if (enteredKey.trim() !== FIELD_ACCESS_KEY) return false;
  localStorage.setItem(STORAGE_KEY, "1");
  return true;
}

export function hasFieldAccess(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function clearFieldAccess(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Header sent alongside cached-data requests / sync pushes while in field mode. */
export function getFieldAccessHeaders(): Record<string, string> {
  if (!hasFieldAccess()) return {};
  return { "X-Field-Key": FIELD_ACCESS_KEY };
}
