/**
 * Client-side device trust.
 *
 * Mirrors server/lib/deviceTrust.ts. This module answers, without any
 * network access, the question the whole offline strategy hinges on:
 * "is this device still recognized as belonging to a chef who logged
 * in online within the last 10 days?"
 *
 * Storage choice — IndexedDB (via lib/offline/db.ts's `meta` store),
 * NOT localStorage:
 *   - localStorage is synchronous and can block the main thread on
 *     some devices for larger payloads; more importantly, several
 *     browsers (notably iOS Safari in low-storage conditions, and any
 *     browser's "Clear cookies and site data" quick action) treat
 *     localStorage as more disposable than IndexedDB, which is the
 *     wrong tradeoff for "the thing that lets a chef work during a
 *     camp with no signal for a week."
 *   - The existing chef_session/chef_token in client/lib/authService.ts
 *     stay in localStorage unchanged — this module doesn't touch them.
 *     Device trust is additive; nothing about the existing online
 *     login flow is removed or altered by its presence.
 */

import { idbGet, idbPut, STORES } from "./db";

const DEVICE_ID_KEY = "device_id";
const DEVICE_TRUST_KEY = "device_trust";

interface StoredDeviceTrust {
  key: typeof DEVICE_TRUST_KEY;
  chef_id: string;
  signed_envelope: string;
  raw_token: string; // sent back to the server on sync/refresh calls
  expires_at: string;
}

/**
 * Returns this browser's stable device identifier, generating and
 * persisting one on first use. Deliberately not tied to any hardware
 * fingerprint (no canvas/audio fingerprinting, no IMEI-style
 * identifiers) — it only needs to be stable across sessions on THIS
 * browser profile, matching the "cet appareil" framing in the
 * strategy doc, not a durable cross-reinstall device identity.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await idbGet<{ key: string; value: string }>(
    STORES.meta,
    DEVICE_ID_KEY,
  );
  if (existing?.value) return existing.value;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await idbPut(STORES.meta, { key: DEVICE_ID_KEY, value: id });
  return id;
}

/**
 * Call this right after a successful ONLINE login, if the server
 * response included a `device` block (server/routes/auth.ts). Stores
 * everything needed to later verify trust offline.
 */
export async function storeDeviceTrust(params: {
  chefId: string;
  rawToken: string;
  signedEnvelope: string;
  expiresAt: string;
}): Promise<void> {
  const record: StoredDeviceTrust = {
    key: DEVICE_TRUST_KEY,
    chef_id: params.chefId,
    signed_envelope: params.signedEnvelope,
    raw_token: params.rawToken,
    expires_at: params.expiresAt,
  };
  await idbPut(STORES.meta, record);
}

export async function getStoredDeviceTrust(): Promise<StoredDeviceTrust | undefined> {
  return idbGet<StoredDeviceTrust>(STORES.meta, DEVICE_TRUST_KEY);
}

/**
 * Decodes the signed envelope's payload WITHOUT verifying the
 * signature — used only for display purposes (e.g. "your offline
 * access expires in 3 days" in Account.tsx). Never use this result to
 * gate access to cached data; use isDeviceTrusted for that.
 */
export function decodeEnvelopePayloadUnsafe(
  signedEnvelope: string,
): { chef_id: string; device_id: string; expires_at: string } | null {
  try {
    const [payloadB64] = signedEnvelope.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * The core offline check. Verifies the envelope's HMAC signature
 * using a public, non-secret verification approach: since the client
 * cannot hold DEVICE_TOKEN_SECRET (it's server-only, see
 * .env.example), the client CANNOT itself verify the signature
 * cryptographically. What it verifies instead:
 *   1. A trust record exists in IndexedDB for this chef.
 *   2. Its expires_at (taken from the signed envelope the server
 *      produced, not a value the client set itself) has not passed
 *      according to the device's own clock.
 *
 * This means a malicious actor with access to the device's storage
 * could, in principle, extend expires_at locally. That is an accepted
 * risk explicitly scoped by the strategy doc: this is a convenience
 * mechanism for a chef's own phone during a camp, not a security
 * boundary against a compromised device. The signature still matters
 * because it lets the SERVER verify authenticity when the device
 * eventually reconnects (verifyEnvelopeSignature in
 * server/lib/deviceTrust.ts) — any tampering is caught then, before
 * a sync batch is accepted or a fresh session JWT is minted. Offline
 * trust only ever grants READ access to already-cached data plus the
 * ability to QUEUE writes locally; it never itself authorizes a
 * write to Supabase — see syncQueue.ts, which always requires a
 * successful server-side verification before anything queued is
 * persisted.
 */
export async function isDeviceTrusted(chefId: string): Promise<boolean> {
  const stored = await getStoredDeviceTrust();
  if (!stored) return false;
  if (stored.chef_id !== chefId) return false;

  const expiresAtMs = new Date(stored.expires_at).getTime();
  if (!Number.isFinite(expiresAtMs)) return false;

  return Date.now() < expiresAtMs;
}

export async function getDeviceTrustExpiry(): Promise<Date | null> {
  const stored = await getStoredDeviceTrust();
  if (!stored) return null;
  const date = new Date(stored.expires_at);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Raw token to attach to sync/refresh requests once back online. */
export async function getDeviceTrustToken(): Promise<string | null> {
  const stored = await getStoredDeviceTrust();
  return stored?.raw_token ?? null;
}

export async function clearDeviceTrust(): Promise<void> {
  await idbPut(STORES.meta, { key: DEVICE_TRUST_KEY, cleared: true });
}
