/**
 * Members offline cache — priority #1 per the v2.0 strategy:
 * "Les informations des membres constituent la priorité absolue."
 *
 * Pattern for every read in this module: try IndexedDB first (works
 * offline, and online it's also just faster than a round trip), and
 * separately trigger a background refresh from Supabase whenever
 * online so the cache doesn't go stale during long connected
 * sessions. This mirrors the stale-while-revalidate shape already
 * implicit in Members.tsx's realtime subscription — we're extending
 * that pattern to survive disconnection, not replacing it.
 */

import { supabase } from "../supabase";
import { idbGetAll, idbGet, idbReplaceAll, idbPut, STORES } from "./db";

export interface CachedMember {
  id: string;
  generated_id: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  age: number | null;
  gender: string | null;
  patrol_name: string | null;
  role_name: string | null;
  is_high_patrol: boolean | null;
  user_phone: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_relationship: string | null;
  guardian_cin: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  home_phone: string | null;
  additional_info: string | null;
  pdf_url: string | null;
  qr_code_url: string | null;
  documents_generated_at: string | null;
  created_at: string;
  updated_at: string;
  // Membership status lives on `users`, not `member_profiles` — see
  // downloadMembersForOffline(), which fetches it via a second query
  // and merges it in by id.
  payment_completed: boolean;
  documents_completed: boolean;
}

const LAST_MEMBERS_SYNC_KEY = "members_last_synced_at";

/**
 * Downloads the full member roster from Supabase and replaces the
 * local cache wholesale. Call this after login (while online) and
 * opportunistically whenever the app regains connectivity.
 *
 * Deliberately a full replace, not an incremental diff: member
 * profiles are a few hundred rows at most for a scout unit, so the
 * simplicity of "always mirror the server exactly" outweighs the
 * bandwidth savings of incremental sync, and it sidesteps ever having
 * a stale-deleted member lingering in the offline cache.
 */
export async function downloadMembersForOffline(): Promise<{
  count: number;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("member_profiles")
      .select("*")
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true });

    if (error) {
      return { count: 0, error: error.message };
    }

    // payment_completed / documents_completed live on `users`, a
    // separate table from member_profiles (see server/routes/membership.ts).
    // Fetched separately and merged in by id so the offline cache carries
    // membership status alongside the rest of the member's profile.
    const { data: statusRows, error: statusError } = await supabase
      .from("users")
      .select("id, payment_completed, documents_completed");

    if (statusError) {
      return { count: 0, error: statusError.message };
    }

    const statusById = new Map(
      (statusRows ?? []).map((row: any) => [row.id, row]),
    );

    const members = (data ?? []).map((member: any) => ({
      ...member,
      payment_completed: statusById.get(member.id)?.payment_completed ?? false,
      documents_completed: statusById.get(member.id)?.documents_completed ?? false,
    })) as CachedMember[];

    await idbReplaceAll(STORES.members, members);
    await idbPut(STORES.meta, {
      key: LAST_MEMBERS_SYNC_KEY,
      value: new Date().toISOString(),
    });

    return { count: members.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { count: 0, error: message };
  }
}

/** Always reads from the local cache — works with or without network. */
export async function getCachedMembers(): Promise<CachedMember[]> {
  return idbGetAll<CachedMember>(STORES.members);
}

export async function getCachedMemberById(
  memberId: string,
): Promise<CachedMember | undefined> {
  return idbGet<CachedMember>(STORES.members, memberId);
}

/** Optimistically patch a member's membership status in the local cache. */
export async function patchCachedMemberMembership(
  memberId: string,
  updates: { payment_completed?: boolean; documents_completed?: boolean },
): Promise<void> {
  const member = await idbGet<CachedMember>(STORES.members, memberId);
  if (!member) return;
  await idbPut(STORES.members, { ...member, ...updates });
}

export async function getMembersLastSyncedAt(): Promise<Date | null> {
  const meta = await idbGet<{ key: string; value: string }>(
    STORES.meta,
    LAST_MEMBERS_SYNC_KEY,
  );
  if (!meta?.value) return null;
  const date = new Date(meta.value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Simple client-side search over the cached roster. Mirrors the
 * filter logic already in Members.tsx so search behaves identically
 * online and offline.
 */
export function searchCachedMembers(
  members: CachedMember[],
  searchTerm: string,
): CachedMember[] {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return members;

  return members.filter(
    (member) =>
      (member.first_name || "").toLowerCase().includes(normalized) ||
      (member.last_name || "").toLowerCase().includes(normalized) ||
      (member.patrol_name || "").toLowerCase().includes(normalized),
  );
}
