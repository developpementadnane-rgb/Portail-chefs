import crypto from "node:crypto";
import { getServerSupabase } from "./supabase";

/**
 * Device trust — the mechanism behind "the chef's phone is recognized
 * for 10 days after an online login" from the v2.0 offline strategy.
 *
 * This file now covers TWO independent trust mechanisms that both
 * grant offline access, chosen per-device at setup time:
 *
 *   A) Personal device trust (issueDeviceToken / verifyDeviceToken):
 *      tied to a real chef account (user_chefs), minted after a
 *      normal CIN/password login. This is what the rest of this
 *      docstring below describes.
 *
 *   B) Shared team passphrase (issueTeamAccessToken /
 *      verifyTeamAccessToken, near the bottom of this file):
 *      NOT tied to any individual chef account. One passphrase,
 *      shared across the whole team, set up by an admin. Presenting
 *      it grants the same offline read/queue capabilities as (A) —
 *      cached member data, queueing attendance — but the resulting
 *      attendance records carry no individual chef identity
 *      (recorded_by_chef_id stays NULL, recorded_via_team_token is
 *      true instead). This exists for the exact scenario described
 *      when this was scoped: a field device that should just work
 *      with a passphrase, no per-chef login, no per-chef audit trail
 *      wanted on the offline actions it takes.
 *
 *      A team access token is deliberately NOT usable for anything
 *      beyond offline member/session reads and attendance queuing —
 *      it can never authenticate a request to routes protected by
 *      requireAuth (server/middleware/requireAuth.ts), which remain
 *      exclusively for real chef sessions. See
 *      server/middleware/requireOfflineAccess.ts, which accepts
 *      EITHER a personal device token OR a team access token, versus
 *      requireAuth, which only ever accepts a personal session JWT.
 *
 * --- (A) Personal device trust, detailed ---
 *
 * This is deliberately NOT the same token as the short-lived session
 * JWT (server/middleware/requireAuth.ts, 12h, used for normal online
 * API calls). Device trust exists for one narrower purpose: let the
 * client locally verify "am I still allowed to read cached member
 * data and queue attendance actions" WITHOUT a network call, for up
 * to 10 days.
 *
 * How it works:
 *  1. On a successful ONLINE login, the server calls issueDeviceToken.
 *     It generates a random token, stores only its sha256 hash in
 *     `trusted_devices` (never the raw token — same principle as the
 *     existing attendance_challenges PIN/token hashing), and returns
 *     the raw token + expiry to the client once.
 *  2. The client stores the raw token in IndexedDB (not localStorage —
 *     see client/lib/offline/deviceTrust.ts for why) alongside the
 *     expiry. It also embeds the expiry inside a signed envelope
 *     (HMAC with DEVICE_TOKEN_SECRET) so the CLIENT can check
 *     "has this expired?" offline without trusting its own clock
 *     alone to invent a fake future expiry — the signature proves the
 *     expiry came from the server.
 *  3. Whenever the client is offline and needs to confirm it's still
 *     authorized (e.g. before showing cached member data), it
 *     verifies the signed envelope locally. This never touches the
 *     network.
 *  4. Whenever the client IS online, it should still prefer the
 *     normal session JWT for actual API calls. The device token's
 *     only server-side use is: (a) re-establishing a session JWT
 *     without re-entering CIN/password when connectivity returns
 *     (verifyDeviceToken), and (b) authorizing attendance sync
 *     batches sent by a device that came back online with a stale or
 *     expired session JWT (see server/routes/attendance.ts).
 *
 * Revocation: an admin (future work) or the chef themselves
 * (Account.tsx "Sign out this device") can call revokeDeviceToken,
 * which sets revoked_at. A revoked device can still read its
 * already-cached local data until the signed envelope's own expiry —
 * revocation is not instant offline (nothing offline-verified can
 * be), but it stops the device from re-syncing or minting a new
 * session JWT the next time it's online.
 */

const DEVICE_TRUST_LIFETIME_MS = 10 * 24 * 60 * 60 * 1000; // 10 days

export interface DeviceTokenIssueResult {
  deviceToken: string;
  signedEnvelope: string;
  expiresAt: string;
}

function getDeviceTokenSecret(): string {
  const secret = process.env.DEVICE_TOKEN_SECRET;
  if (!secret) {
    throw new Error("DEVICE_TOKEN_SECRET is not configured");
  }
  return secret;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Builds a signed envelope the client can verify offline:
 *   base64url(payloadJson) + "." + hmacSha256(payloadJson)
 * This is intentionally simpler than a full JWT (no header, no alg
 * negotiation) since it only ever needs to be verified by this same
 * codebase with one fixed algorithm.
 */
function signEnvelope(payload: {
  chef_id: string;
  device_id: string;
  expires_at: string;
}): string {
  const secret = getDeviceTokenSecret();
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

/**
 * Issue or refresh a trusted-device record for a chef who just logged
 * in online. Call this from server/routes/auth.ts after a successful
 * CIN/password check.
 */
export async function issueDeviceToken(
  chefId: string,
  deviceId: string,
  deviceLabel?: string,
): Promise<DeviceTokenIssueResult> {
  const supabase = getServerSupabase();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + DEVICE_TRUST_LIFETIME_MS);

  const { error } = await supabase.from("trusted_devices").upsert(
    {
      chef_id: chefId,
      device_id: deviceId,
      device_label: deviceLabel ?? null,
      device_token_hash: tokenHash,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_seen_online_at: issuedAt.toISOString(),
      revoked_at: null,
    },
    { onConflict: "chef_id,device_id" },
  );

  if (error) {
    throw new Error(`Failed to issue device token: ${error.message}`);
  }

  const signedEnvelope = signEnvelope({
    chef_id: chefId,
    device_id: deviceId,
    expires_at: expiresAt.toISOString(),
  });

  return {
    deviceToken: rawToken,
    signedEnvelope,
    expiresAt: expiresAt.toISOString(),
  };
}

export interface DeviceTokenVerifyResult {
  valid: boolean;
  chefId?: string;
  reason?: "invalid_signature" | "expired" | "revoked" | "not_found" | "mismatched_hash";
}

/**
 * Server-side verification of a device token presented by a client
 * that has regained connectivity (e.g. to sync a queued attendance
 * batch, or to silently mint a fresh session JWT). This DOES hit the
 * database, unlike the client-side envelope check, because the server
 * must also confirm the device hasn't been revoked since the token
 * was issued.
 */
export async function verifyDeviceToken(
  rawToken: string,
  chefId: string,
  deviceId: string,
): Promise<DeviceTokenVerifyResult> {
  const supabase = getServerSupabase();
  const { data: record, error } = await supabase
    .from("trusted_devices")
    .select("device_token_hash, expires_at, revoked_at")
    .eq("chef_id", chefId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (error || !record) {
    return { valid: false, reason: "not_found" };
  }

  if (record.revoked_at) {
    return { valid: false, reason: "revoked" };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  const presentedHash = hashToken(rawToken);
  // Constant-time comparison to avoid timing side-channels on the hash.
  const presentedBuf = Buffer.from(presentedHash, "hex");
  const storedBuf = Buffer.from(record.device_token_hash, "hex");
  const matches =
    presentedBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(presentedBuf, storedBuf);

  if (!matches) {
    return { valid: false, reason: "mismatched_hash" };
  }

  // Refresh last_seen_online_at opportunistically; failure here
  // shouldn't fail the request.
  await supabase
    .from("trusted_devices")
    .update({ last_seen_online_at: new Date().toISOString() })
    .eq("chef_id", chefId)
    .eq("device_id", deviceId);

  return { valid: true, chefId };
}

/**
 * Client-side-equivalent signature check, exposed here too so the
 * server can re-verify an envelope a client sends back (belt and
 * braces — the server never trusts an envelope's claims without
 * either this check or the DB check above, and for anything
 * write-worthy it always additionally calls verifyDeviceToken).
 */
export function verifyEnvelopeSignature(
  signedEnvelope: string,
): { valid: boolean; payload?: { chef_id: string; device_id: string; expires_at: string } } {
  const [payloadB64, signature] = signedEnvelope.split(".");
  if (!payloadB64 || !signature) return { valid: false };

  const secret = getDeviceTokenSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    );
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export async function revokeDeviceToken(
  chefId: string,
  deviceId: string,
): Promise<void> {
  const supabase = getServerSupabase();
  await supabase
    .from("trusted_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("chef_id", chefId)
    .eq("device_id", deviceId);
}

export async function listTrustedDevices(chefId: string) {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("trusted_devices")
    .select("device_id, device_label, issued_at, expires_at, last_seen_online_at, revoked_at")
    .eq("chef_id", chefId)
    .order("last_seen_online_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list trusted devices: ${error.message}`);
  }

  return data ?? [];
}

// ============================================================
// (B) Shared team passphrase — no individual chef identity.
// ============================================================
//
// Storage: a single-row table `team_access_passphrase` (see
// docs/OFFLINE_SUPABASE_MIGRATIONS.sql). Only ever one active row —
// setting a new passphrase overwrites it, immediately invalidating
// every previously-issued team token (their signatures still verify
// cryptographically, since the HMAC secret doesn't change, but
// verifyTeamAccessToken additionally checks the token's
// passphrase_version against the current row, so old tokens are
// rejected the moment the passphrase rotates).
//
// This is intentionally a much lower assurance level than personal
// device trust: anyone who knows the shared passphrase can access
// cached member data and queue attendance from any device. That is
// the explicit tradeoff requested — a field passphrase, not a login
// — so the mitigations available are: (1) rotate the passphrase
// periodically via issueOrRotateTeamPassphrase, (2) the resulting
// token still can't touch anything outside the narrow offline
// surface (see requireOfflineAccess middleware), and (3) every
// attendance record written via a team token is flagged
// recorded_via_team_token = true in attendance_sync_log for later
// review, even though no individual is named.

const TEAM_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — longer-lived than personal device trust since there's no per-login renewal moment to piggyback on; rotate the passphrase itself to force earlier expiry across the whole team.

function hashPassphrase(passphrase: string, salt: string): string {
  return crypto.scryptSync(passphrase, salt, 64).toString("hex");
}

/**
 * Admin operation: set or rotate the team passphrase. Call this from
 * an admin-only route (see server/routes/auth.ts's
 * /team-passphrase, gated separately — not part of this file's
 * concern). Returns nothing sensitive; the plaintext passphrase is
 * never stored, only its salted hash.
 */
export async function issueOrRotateTeamPassphrase(
  plaintextPassphrase: string,
  setByChefId: string,
): Promise<{ version: number }> {
  const supabase = getServerSupabase();
  const salt = crypto.randomBytes(16).toString("hex");
  const passphraseHash = hashPassphrase(plaintextPassphrase, salt);

  const { data: current } = await supabase
    .from("team_access_passphrase")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (current?.version ?? 0) + 1;

  const { error } = await supabase.from("team_access_passphrase").insert({
    version: nextVersion,
    passphrase_hash: passphraseHash,
    salt,
    set_by_chef_id: setByChefId,
  });

  if (error) {
    throw new Error(`Failed to set team passphrase: ${error.message}`);
  }

  return { version: nextVersion };
}

export interface TeamAccessIssueResult {
  teamToken: string;
  signedEnvelope: string;
  expiresAt: string;
}

/**
 * Verifies a presented passphrase against the current active row and,
 * if it matches, issues a team access token — same shape as a
 * personal device token (raw token + signed envelope) but with no
 * chef_id, only a passphrase_version so it can be invalidated by
 * rotation.
 */
export async function issueTeamAccessToken(
  plaintextPassphrase: string,
  deviceId: string,
): Promise<TeamAccessIssueResult | null> {
  const supabase = getServerSupabase();
  const { data: current, error } = await supabase
    .from("team_access_passphrase")
    .select("version, passphrase_hash, salt")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !current) return null;

  const presentedHash = hashPassphrase(plaintextPassphrase, current.salt);
  const presentedBuf = Buffer.from(presentedHash, "hex");
  const storedBuf = Buffer.from(current.passphrase_hash, "hex");
  const matches =
    presentedBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(presentedBuf, storedBuf);

  if (!matches) return null;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + TEAM_TOKEN_LIFETIME_MS);

  const { error: insertError } = await supabase.from("team_access_tokens").insert({
    device_id: deviceId,
    token_hash: tokenHash,
    passphrase_version: current.version,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    throw new Error(`Failed to issue team access token: ${insertError.message}`);
  }

  const secret = getDeviceTokenSecret();
  const payloadJson = JSON.stringify({
    kind: "team",
    device_id: deviceId,
    passphrase_version: current.version,
    expires_at: expiresAt.toISOString(),
  });
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");

  return {
    teamToken: rawToken,
    signedEnvelope: `${payloadB64}.${signature}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export interface TeamAccessVerifyResult {
  valid: boolean;
  reason?: "invalid_signature" | "expired" | "revoked" | "not_found" | "mismatched_hash" | "passphrase_rotated";
}

/**
 * Server-side verification of a team access token. Checks, in order:
 * signature validity, DB record exists and hash matches, not
 * revoked, not expired, AND that passphrase_version still matches
 * the currently active passphrase row (catches the rotation case:
 * the token's own signature and hash are still technically valid,
 * but the team passphrase has since changed, so this device's access
 * should no longer be honored).
 */
export async function verifyTeamAccessToken(
  rawToken: string,
  deviceId: string,
): Promise<TeamAccessVerifyResult> {
  const supabase = getServerSupabase();
  const { data: record, error } = await supabase
    .from("team_access_tokens")
    .select("token_hash, passphrase_version, expires_at, revoked_at")
    .eq("device_id", deviceId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !record) return { valid: false, reason: "not_found" };
  if (record.revoked_at) return { valid: false, reason: "revoked" };
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  const presentedHash = hashToken(rawToken);
  const presentedBuf = Buffer.from(presentedHash, "hex");
  const storedBuf = Buffer.from(record.token_hash, "hex");
  const matches =
    presentedBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(presentedBuf, storedBuf);

  if (!matches) return { valid: false, reason: "mismatched_hash" };

  const { data: current } = await supabase
    .from("team_access_passphrase")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!current || current.version !== record.passphrase_version) {
    return { valid: false, reason: "passphrase_rotated" };
  }

  return { valid: true };
}
