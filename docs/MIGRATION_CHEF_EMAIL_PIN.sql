-- Point 5 (demande Adnane) -- ajoute un champ e-mail à l'inscription des
-- chefs, vérifié par PIN envoyé via le même SMTP que le site des membres.
--
-- À exécuter UNE FOIS dans le SQL editor de Supabase (le même projet que
-- App-membre, même SUPABASE_URL dans les deux .env). Sans ça, les routes
-- server/routes/auth.ts (register/login) et server/routes/email.ts ajoutées
-- dans ce commit échoueront avec "column does not exist".

-- 1) Champ e-mail + statut de vérification sur les comptes chefs.
ALTER TABLE public.user_chefs
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS user_chefs_email_unique_idx
  ON public.user_chefs (lower(email))
  WHERE email IS NOT NULL;

-- 2) La table `pins` existe déjà côté App-membre (voir
--    database/create-pins.sql dans ce dépôt) et vit dans le MÊME projet
--    Supabase (même SUPABASE_URL) -- donc Qiadati peut la réutiliser
--    telle quelle pour ses propres PIN de vérification d'e-mail. Ce bloc
--    est un simple filet de sécurité si jamais elle n'a pas encore été
--    créée sur ce projet :
CREATE TABLE IF NOT EXISTS public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  pin TEXT NOT NULL CHECK (pin ~ '^[0-9]{6}$'),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS pins_email_generated_at_idx
  ON public.pins (email, generated_at DESC);

ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
