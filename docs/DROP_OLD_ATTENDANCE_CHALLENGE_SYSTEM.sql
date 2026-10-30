-- Suppression définitive de l'ancien système QR+PIN+TOTP de présence
-- (le chef générait un QR/PIN de séance, le membre le scannait).
-- Remplacé par le nouveau flux : le chef scanne le badge du membre
-- (voir attendance_records.recorded_via = 'chef_badge_scan').
--
-- Ordre important : on retire d'abord la contrainte de clé étrangère
-- qui relie attendance_records à attendance_check_ins, puis on
-- supprime les deux tables dans l'ordre inverse de leurs dépendances
-- (attendance_check_ins dépend de attendance_challenges).

-- 1. Retirer la FK sur attendance_records (la colonne check_in_id
--    reste, mais devient une simple colonne orpheline sans contrainte
--    -- inoffensif, elle n'est plus utilisée par le nouveau flux).
ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_check_in_id_fkey;

-- 2. Supprimer attendance_check_ins (dépend de attendance_challenges
--    via challenge_id).
DROP TABLE IF EXISTS attendance_check_ins CASCADE;

-- 3. Supprimer attendance_challenges.
DROP TABLE IF EXISTS attendance_challenges CASCADE;

-- Optionnel : si vous voulez aussi nettoyer la colonne devenue
-- orpheline sur attendance_records, décommentez la ligne suivante.
-- Sans danger de le laisser tel quel (elle sera simplement toujours
-- NULL pour toute nouvelle présence enregistrée via le nouveau flux).
-- ALTER TABLE attendance_records DROP COLUMN IF EXISTS check_in_id;
