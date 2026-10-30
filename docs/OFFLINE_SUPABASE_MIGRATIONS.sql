-- Qada v2.0 — Offline support
-- Run this in the Supabase SQL editor. Additive only: nothing here
-- alters or drops existing tables (user_chefs, member_profiles,
-- sessions, attendance_challenges, reports, ideas, etc), and every
-- ALTER below is idempotent (IF NOT EXISTS / guarded) so re-running
-- this whole file after a partial run is safe.
--
-- Six new tables:
--   1. trusted_devices          — personal device-trust records (10-day
--                                  offline auth, tied to a real chef
--                                  account via CIN/password login)
--   2. attendance_records       — the actual presence/absence entries
--                                  (attendance_challenges only issues the
--                                  QR/PIN challenge — nothing previously
--                                  persisted an actual check-in)
--   3. attendance_sync_log      — audit trail of sync batches, useful
--                                  for debugging conflicting syncs from
--                                  multiple chef devices
--   4. team_access_passphrase   — the single active shared passphrase
--                                  (no individual chef identity)
--   5. team_access_tokens       — tokens issued from a valid passphrase
--                                  presentation, one per device
--   6. attendance_check_ins     — records that a chef's challenge token
--                                  and a member's presented token were
--                                  compared and matched, so a
--                                  third party who never saw the real
--                                  QR/PIN can be ruled out even when
--                                  both sides synced hours apart

-- ============================================================
-- 1. trusted_devices  (personal, tied to user_chefs)
-- ============================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID NOT NULL REFERENCES user_chefs(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL, -- client-generated stable identifier (crypto.randomUUID, persisted in IndexedDB)
  device_label TEXT, -- optional human-readable label ("Samsung A14 - Chef Yassine")
  device_token_hash TEXT NOT NULL, -- sha256 of the token the client stores
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- issued_at + 10 days
  last_seen_online_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (chef_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_chef ON trusted_devices(chef_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires ON trusted_devices(expires_at);

ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
-- Server-only table (service-role key) — see server/lib/deviceTrust.ts.

-- ============================================================
-- 2. attendance_records
-- ============================================================
-- The actual "member X was present/absent at session Y" fact.
-- client_op_id is the linchpin of the offline sync strategy: it is
-- generated on-device the moment a chef taps "present", BEFORE any
-- network call, and never changes across retries/duplicate syncs.
-- The UNIQUE constraint on client_op_id makes upsert-by-client_op_id
-- an idempotent operation.
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_op_id UUID NOT NULL UNIQUE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
  -- Nullable: a record written via the shared team passphrase (see
  -- team_access_tokens below) carries no individual chef identity by
  -- design — that was an explicit product decision, not an oversight.
  recorded_by_chef_id UUID REFERENCES user_chefs(id) ON DELETE SET NULL,
  recorded_by_device_id TEXT,
  -- True when this record was written using the shared team
  -- passphrase rather than a personal chef session/device-trust.
  -- Lets anyone reviewing attendance later understand why
  -- recorded_by_chef_id is NULL: "team token, no individual on
  -- record" versus "chef account was deleted after the fact".
  recorded_via_team_token BOOLEAN NOT NULL DEFAULT false,
  recorded_via TEXT NOT NULL DEFAULT 'chef_manual' CHECK (recorded_via IN ('chef_manual', 'qr_pin_checkin')),
  -- Set only when recorded_via = 'qr_pin_checkin' AND the chef-side
  -- token and member-side token were cross-verified against the same
  -- attendance_challenges row — see attendance_check_ins below and
  -- server/routes/attendance.ts's /check-in endpoint. NULL for
  -- chef_manual roll-call entries, which have no challenge to compare.
  -- No inline REFERENCES here: attendance_check_ins (table #6) is
  -- defined later in this file, and Postgres rejects a forward FK
  -- reference to a not-yet-created table even within one script. The
  -- actual foreign key is added via ALTER TABLE at the bottom of this
  -- file, once attendance_check_ins exists. This column is a plain
  -- UUID until that ALTER TABLE runs.
  check_in_id UUID,
  client_recorded_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_member ON attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_client_op ON attendance_records(client_op_id);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_attendance_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION set_attendance_records_updated_at();

-- ============================================================
-- 3. attendance_sync_log
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chef_id UUID REFERENCES user_chefs(id) ON DELETE SET NULL,
  device_id TEXT,
  used_team_token BOOLEAN NOT NULL DEFAULT false,
  batch_size INTEGER NOT NULL,
  accepted_count INTEGER NOT NULL,
  duplicate_count INTEGER NOT NULL,
  conflict_count INTEGER NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_sync_log_chef ON attendance_sync_log(chef_id);

ALTER TABLE attendance_sync_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. team_access_passphrase  (single active row = current passphrase)
-- ============================================================
-- Every insert here is a rotation: `version` strictly increases, and
-- verifyTeamAccessToken (server/lib/deviceTrust.ts) always checks
-- against MAX(version), so inserting a new row instantly invalidates
-- every token issued against an older version, without needing to
-- touch team_access_tokens at all. Old rows are kept (not deleted)
-- purely as a rotation history — they are never read for verification
-- once a newer version exists.
CREATE TABLE IF NOT EXISTS team_access_passphrase (
  version INTEGER PRIMARY KEY,
  passphrase_hash TEXT NOT NULL, -- scrypt(passphrase, salt), never the plaintext
  salt TEXT NOT NULL,
  set_by_chef_id UUID REFERENCES user_chefs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE team_access_passphrase ENABLE ROW LEVEL SECURITY;
-- Server-only (service-role key). Never exposed to any client role —
-- even the hash should not be readable by the anon/authenticated
-- Postgres roles, since a hash + known-weak passphrase is still a
-- meaningful offline cracking target for a shared team secret.

-- ============================================================
-- 5. team_access_tokens
-- ============================================================
-- One row per device that has successfully presented the current (or
-- a since-rotated) team passphrase. Deliberately keyed by device_id
-- rather than any chef identity — this is the whole point of the
-- shared-passphrase mode. A device can hold at most a growing history
-- of tokens (old ones simply age out via expires_at or get orphaned
-- by a passphrase rotation); verification always takes the most
-- recently issued one for that device_id.
CREATE TABLE IF NOT EXISTS team_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  passphrase_version INTEGER NOT NULL REFERENCES team_access_passphrase(version) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_team_access_tokens_device ON team_access_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_team_access_tokens_version ON team_access_tokens(passphrase_version);

ALTER TABLE team_access_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. attendance_check_ins  (chef-token / member-token cross-verification)
-- ============================================================
-- Records the outcome of comparing the chef's attendance_challenges
-- token against the token a member's device presented, so that a
-- third party who never actually saw the real QR/PIN can be
-- distinguished from a genuine member check-in — even when the
-- chef's device and the member's device sync at completely different
-- times (per the strategy: "le chef peut enregistrer une présence,
-- puis le membre peut retrouver Internet plusieurs heures plus tard
-- — ou l'inverse").
--
-- How the comparison works end to end:
--   1. Chef generates a challenge (existing POST /api/attendance/challenges):
--      a token_hash + pin_hash are stored in attendance_challenges,
--      the raw token/PIN are shown to the chef (via QR/on-screen PIN)
--      and never stored in plaintext server-side.
--   2. A member's device (the separate members portal) captures that
--      raw token (from the QR) or PIN, and stores it LOCALLY — the
--      member's device may itself be offline at this moment.
--   3. Whenever the member's device reaches the server (independently
--      of the chef's own connectivity), it POSTs the raw token/PIN it
--      captured to /api/attendance/check-in.
--   4. The server hashes what was presented and compares against the
--      stored token_hash/pin_hash on the matching attendance_challenges
--      row. Only someone who actually saw the real QR/PIN can produce
--      a matching hash — this is the elimination of a third party
--      the passphrase-only trust level (team_access_tokens) does not
--      by itself provide.
--   5. A matching comparison inserts a row here (one per challenge —
--      UNIQUE constraint prevents replaying the same challenge twice
--      into two different check-ins) and the resulting attendance_records
--      row references it via check_in_id, so anyone auditing later can
--      see exactly which challenge authorized which attendance fact.
CREATE TABLE IF NOT EXISTS attendance_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL UNIQUE REFERENCES attendance_challenges(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES member_profiles(id) ON DELETE CASCADE,
  matched_via TEXT NOT NULL CHECK (matched_via IN ('qr_token', 'pin')),
  -- The member device's own local timestamp for when it captured the
  -- token/PIN — analogous to client_recorded_at on attendance_records,
  -- and for the same reason: this device may sync long after the
  -- moment the check-in actually happened.
  member_captured_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_check_ins_member ON attendance_check_ins(member_id);

ALTER TABLE attendance_check_ins ENABLE ROW LEVEL SECURITY;

-- attendance_records.check_in_id is declared as a plain UUID above
-- (table #2) because attendance_check_ins (table #6) doesn't exist
-- yet at that point in this script. The actual foreign key
-- constraint is added here, now that both tables exist. Run this
-- file top to bottom in one go (e.g. paste the whole thing into the
-- Supabase SQL editor at once) so this ALTER TABLE runs after both
-- CREATE TABLE statements above.
ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_check_in_id_fkey;
ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_check_in_id_fkey
  FOREIGN KEY (check_in_id) REFERENCES attendance_check_ins(id) ON DELETE SET NULL;
