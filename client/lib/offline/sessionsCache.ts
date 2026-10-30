/**
 * Sessions offline cache — priority #2 per the v2.0 strategy.
 * Unlike members (full mirror, see membersCache.ts), sessions are
 * intentionally NOT fully mirrored: "il n'est pas nécessaire de
 * conserver tout l'historique des séances : seules les séances
 * utiles pendant ces dix jours sont nécessaires."
 *
 * The filtering itself happens server-side
 * (GET /api/attendance/relevant-sessions, see server/routes/attendance.ts)
 * so the window logic lives in exactly one place rather than being
 * duplicated client-side and risking drift.
 */

import { idbGetAll, idbGet, idbReplaceAll, idbPut, STORES } from "./db";
import { getAuthHeaders } from "../api";
import { getOfflineAuthHeaders, getOfflineChefId } from "./accessMode";
import { API_BASE_URL } from "../apiConfig";

export interface CachedSession {
  id: string;
  title: string | null;
  date_time: string | null;
  location: string | null;
  target_audience: string | null;
  objective: string | null;
  methodology: string | null;
  created_at: string;
}

const LAST_SESSIONS_SYNC_KEY = "sessions_last_synced_at";
const DEVICE_TRUST_WINDOW_DAYS = 10;

export async function downloadRelevantSessionsForOffline(): Promise<{
  count: number;
  error: string | null;
}> {
  try {
    // requireOfflineAccess (server/middleware/requireOfflineAccess.ts)
    // needs chef_id to verify a personal device token. POST routes
    // send it in the body, but this is a GET with no body -- send it
    // as a query param instead, which the server now also accepts.
    const chefId = await getOfflineChefId();
    const params = new URLSearchParams({ days: String(DEVICE_TRUST_WINDOW_DAYS) });
    if (chefId) params.set("chef_id", chefId);

    const response = await fetch(
      `${API_BASE_URL}/api/attendance/relevant-sessions?${params.toString()}`,
      { headers: { ...getAuthHeaders(), ...(await getOfflineAuthHeaders()) } },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return { count: 0, error: body?.error || "Impossible de charger les séances" };
    }

    const body: { sessions: CachedSession[] } = await response.json();
    await idbReplaceAll(STORES.sessions, body.sessions);
    await idbPut(STORES.meta, {
      key: LAST_SESSIONS_SYNC_KEY,
      value: new Date().toISOString(),
    });

    return { count: body.sessions.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { count: 0, error: message };
  }
}

export async function getCachedSessions(): Promise<CachedSession[]> {
  const sessions = await idbGetAll<CachedSession>(STORES.sessions);
  return sessions.sort((a, b) => {
    const dateA = new Date(a.date_time || a.created_at).getTime();
    const dateB = new Date(b.date_time || b.created_at).getTime();
    return dateB - dateA;
  });
}

export async function getCachedSessionById(
  sessionId: string,
): Promise<CachedSession | undefined> {
  return idbGet<CachedSession>(STORES.sessions, sessionId);
}

export async function getSessionsLastSyncedAt(): Promise<Date | null> {
  const meta = await idbGet<{ key: string; value: string }>(
    STORES.meta,
    LAST_SESSIONS_SYNC_KEY,
  );
  if (!meta?.value) return null;
  const date = new Date(meta.value);
  return Number.isNaN(date.getTime()) ? null : date;
}
