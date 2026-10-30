import crypto from "node:crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getServerSupabase } from "../lib/supabase";
import { issueDeviceToken } from "../lib/deviceTrust";

const router = Router();

router.post("/register", async (req, res) => {
  const cin = typeof req.body?.cin === "string" ? req.body.cin.trim() : "";
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
  const dateOfBirth = typeof req.body?.dateOfBirth === "string" ? req.body.dateOfBirth : null;
  const can = typeof req.body?.can === "string" ? req.body.can.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  // Code distribué en face-à-face ou par message aux chefs légitimes,
  // format XXX-XXX/YY (voir chef_whitelist). Remplace l'inscription libre :
  // sans code valide et correspondant à l'identité saisie, pas de compte.
  const referenceCode = typeof req.body?.referenceCode === "string" ? req.body.referenceCode.trim() : "";

  if (!cin || !firstName || !lastName || !can || !phone || !password || !email || !referenceCode) {
    return res.status(400).json({ error: "Tous les champs sont requis, y compris le code de vérification", data: null });
  }

  if (!/^[0-9]{3}-[0-9]{3}\/[0-9]{2}$/.test(referenceCode)) {
    return res.status(400).json({ error: "Format de code invalide (attendu : 123-456/78)", data: null });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Adresse e-mail invalide", data: null });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères", data: null });
  }

  try {
    const supabase = getServerSupabase();

    const { data: existing } = await supabase
      .from("user_chefs")
      .select("cin")
      .eq("cin", cin)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: "Ce numéro CIN est déjà enregistré", data: null });
    }

    const { data: existingEmail } = await supabase
      .from("user_chefs")
      .select("cin")
      .ilike("email", email)
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée", data: null });
    }

    // Vérification contre la liste de référence (CSV chargé dans
    // chef_whitelist) : le code doit exister, être encore inutilisé, et le
    // nom/prénom saisis doivent correspondre -- un code seul ne suffit pas
    // à prouver l'identité si jamais il est intercepté.
    const normalize = (v: string) => v.trim().toLowerCase();
    const { data: whitelistEntry, error: whitelistError } = await supabase
      .from("chef_whitelist")
      .select("id, first_name, last_name, phone, email, used")
      .eq("code", referenceCode)
      .maybeSingle();

    if (whitelistError) {
      console.error("Whitelist lookup error:", whitelistError);
      return res.status(500).json({ error: "Erreur lors de la vérification du code", data: null });
    }

    if (!whitelistEntry) {
      return res.status(403).json({ error: "Code de vérification introuvable", data: null });
    }

    if (whitelistEntry.used) {
      return res.status(409).json({ error: "Ce code a déjà été utilisé", data: null });
    }

    const nameMatches =
      normalize(whitelistEntry.first_name) === normalize(firstName) &&
      normalize(whitelistEntry.last_name) === normalize(lastName);

    if (!nameMatches) {
      return res.status(403).json({ error: "Le nom et prénom ne correspondent pas au code fourni", data: null });
    }

    // bcrypt, not the old sha256: salted + adaptive-cost, unlike a bare
    // sha256 digest which is fast to brute-force and has no per-user salt.
    const passwordHash = await bcrypt.hash(password, 12);

    const { data: newChef, error } = await supabase
      .from("user_chefs")
      .insert({
        cin,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        can,
        phone,
        password_hash: passwordHash,
        email,
        email_verified_at: null,
      })
      .select()
      .single();

    if (error || !newChef) {
      return res.status(400).json({ error: error?.message || "Erreur lors de l'inscription", data: null });
    }

    // Marque le code comme consommé -- irréversible côté inscription (un
    // code = un seul compte). En cas d'échec ici, le compte existe déjà ;
    // ce n'est pas bloquant pour l'inscription, juste loggé.
    const { error: markUsedError } = await supabase
      .from("chef_whitelist")
      .update({ used: true, used_by_chef_id: newChef.id, used_at: new Date().toISOString() })
      .eq("id", whitelistEntry.id)
      .eq("used", false);

    if (markUsedError) {
      console.error("Erreur lors du marquage du code whitelist comme utilisé:", markUsedError);
    }

    const { password_hash: _passwordHash, ...safeChef } = newChef;
    res.json({ error: null, data: safeChef });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Erreur lors de l'inscription", data: null });
  }
});

router.post("/login", async (req, res) => {
  const cin = typeof req.body?.cin === "string" ? req.body.cin.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
  // Optional: present when the client already has (or just generated)
  // a stable local device identifier. Absent on first-ever login
  // before client/lib/offline/deviceTrust.ts has created one, or on
  // clients that opt out of offline mode entirely. Login must succeed
  // either way — device trust is additive, never a login requirement.
  const deviceId = typeof req.body?.device_id === "string" ? req.body.device_id.trim() : "";
  const deviceLabel = typeof req.body?.device_label === "string" ? req.body.device_label.trim() : undefined;
  const secret = process.env.JWT_SECRET;

  if (!cin || !password || !firstName || !lastName) {
    return res.status(400).json({ error: "All login fields are required", data: null });
  }

  try {
    const supabase = getServerSupabase();
    const { data: chef, error } = await supabase
      .from("user_chefs")
      .select("*")
      .eq("cin", cin)
      .maybeSingle();

    if (error || !chef) {
      return res.status(401).json({ error: "CIN ou mot de passe incorrect", data: null });
    }

    // Transparent migration: existing accounts still have an old sha256
    // hash (64 hex chars, no bcrypt "$2..." prefix). Verify against that
    // once, then silently re-hash with bcrypt so the account is upgraded
    // on its very next successful login -- no forced password reset for
    // anyone.
    const storedHash = typeof chef.password_hash === "string" ? chef.password_hash : "";
    const isLegacySha256Hash = /^[a-f0-9]{64}$/i.test(storedHash);

    let passwordMatches: boolean;
    if (isLegacySha256Hash) {
      const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
      passwordMatches = legacyHash === storedHash;
    } else {
      passwordMatches = await bcrypt.compare(password, storedHash);
    }

    if (!passwordMatches) {
      return res.status(401).json({ error: "CIN ou mot de passe incorrect", data: null });
    }

    // Only accounts created after point 5's migration have an email on
    // file. Existing chefs (email === null) are grandfathered in and
    // never blocked by this check -- only an account that HAS an email
    // but hasn't confirmed its PIN yet gets refused.
    if (chef.email && !chef.email_verified_at) {
      return res.status(403).json({
        error: "Adresse e-mail non confirmée. Vérifiez votre boîte de réception pour le code envoyé à l'inscription.",
        error_code: "EMAIL_NOT_VERIFIED",
        email: chef.email,
        data: null,
      });
    }

    if (isLegacySha256Hash) {
      const upgradedHash = await bcrypt.hash(password, 12);
      await supabase.from("user_chefs").update({ password_hash: upgradedHash }).eq("id", chef.id);
    }

    if (
      typeof chef.first_name !== "string" ||
      typeof chef.last_name !== "string" ||
      chef.first_name.trim().toLowerCase() !== firstName.toLowerCase() ||
      chef.last_name.trim().toLowerCase() !== lastName.toLowerCase()
    ) {
      return res.status(401).json({ error: "Le nom ou le prénom ne correspond pas au CIN", data: null });
    }

    const { password_hash: _passwordHash, ...safeChef } = chef;
    let token: string | null = null;

    // "Se souvenir de moi" : 21 jours au lieu de 12h. C'est la cause de
    // la déconnexion automatique signalée -- avant ce changement, aucune
    // option longue durée n'existait côté chefs (contrairement au
    // portail membres, qui utilise un token quasi permanent).
    const rememberMe = req.body?.rememberMe === true;
    const tokenTtl = rememberMe ? "21d" : "12h";

    if (secret) {
      try {
        token = jwt.sign({ user_id: String(chef.id) }, secret, { expiresIn: tokenTtl });
      } catch (error) {
        console.error("JWT creation failed:", error);
      }
    }

    // Device trust: only attempted when the client sent a device_id
    // AND DEVICE_TOKEN_SECRET is configured. Neither being present is
    // a login failure — it just means this device won't get offline
    // access until both are true (e.g. staging environments that
    // don't set DEVICE_TOKEN_SECRET keep working exactly as before).
    let device: { token: string; signed_envelope: string; expires_at: string } | null = null;
    if (deviceId && process.env.DEVICE_TOKEN_SECRET) {
      try {
        const issued = await issueDeviceToken(String(chef.id), deviceId, deviceLabel);
        device = {
          token: issued.deviceToken,
          signed_envelope: issued.signedEnvelope,
          expires_at: issued.expiresAt,
        };
      } catch (deviceError) {
        // Device trust is a bonus, not a login blocker. Log and
        // continue with a normal online-only session.
        console.error("Device token issuance failed:", deviceError);
      }
    }

    return res.json({ error: null, data: safeChef, token, device });
  } catch (error) {
    console.error("Chef login error:", error);
    return res.status(500).json({ error: "Erreur lors de la connexion", data: null });
  }
});

export default router;
