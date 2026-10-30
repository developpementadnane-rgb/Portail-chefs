-- Migration : nouveau flux de présence par scan du badge membre.
-- À exécuter dans l'éditeur SQL Supabase (projet partagé avec l'app membres).
--
-- Contexte : l'ancien flux (chef génère un QR+PIN+TOTP de séance, le
-- membre le scanne) est retiré. Le nouveau flux inverse les rôles : le
-- chef scanne le badge personnel du membre. La colonne
-- attendance_records.recorded_via a pour défaut 'chef_manual' ; si une
-- contrainte CHECK limite ses valeurs possibles, cette migration
-- l'élargit pour accepter 'chef_badge_scan'. Si aucune contrainte
-- CHECK n'existe (valeur libre en texte), ce script ne fait rien de
-- risqué : le DROP CONSTRAINT IF EXISTS est un no-op dans ce cas.

ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_recorded_via_check;

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_recorded_via_check
  CHECK (recorded_via IN ('chef_manual', 'qr_pin_checkin', 'chef_badge_scan'));
