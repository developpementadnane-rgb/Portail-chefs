import { randomInt } from "node:crypto";
import { Router } from "express";
import nodemailer from "nodemailer";
import { getServerSupabase } from "../lib/supabase";

/**
 * Sends and verifies the e-mail confirmation PIN for chef sign-up
 * (point 5 in Adnane's list). Deliberately mirrors, field-for-field,
 * App-membre's server/routes/email.ts (handleSendEmail's PIN branch +
 * handleVerifyPin): SAME `pins` table, SAME SMTP_* env vars. Both
 * repos' SUPABASE_URL point at the same Supabase project (see
 * .env.example in both repos), so the `pins` table this writes to is
 * literally the same table App-membre already uses -- no separate
 * table, no separate SMTP config to keep in sync by hand.
 *
 * Requires these env vars (same values as App-membre's, copy them
 * from there into Qiadati's GitHub/Netlify secrets):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 */

const PIN_TTL_MS = 5 * 60 * 1000;

const router = Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function generatePin(): string {
  return String(randomInt(100000, 1000000));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPinEmail(firstName: string, pin: string): string {
  const safeName = escapeHtml(firstName || "Chef");
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f7;padding:20px}.card{max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}h1{color:#2c3e50;font-size:20px}p{color:#444;line-height:1.5}.pin{display:inline-block;margin:16px 0;padding:12px 24px;font-size:28px;letter-spacing:6px;font-weight:bold;color:#fff;background:#2c3e50;border-radius:6px}.footer{margin-top:20px;font-size:12px;color:#999;text-align:center}
</style></head><body><div class="card"><h1>Confirmation de votre compte SHM Qiadati</h1><p>Bonjour ${safeName},</p><p>Voici votre code de confirmation :</p><div class="pin">${pin}</div><p>Ce code expire dans 5 minutes et ne peut être utilisé qu'une seule fois.</p></div><div class="footer">Envoyé automatiquement depuis Qiadati -- Scoutisme Hassanien Marocain Safi</div></body></html>`;
}

/**
 * POST /api/auth/send-verification-pin
 * Body: { email, firstName? }
 * Generates a 6-digit PIN, stores it in the shared `pins` table, and
 * emails it. Called right after registration, and again if the chef
 * asks to resend it.
 */
router.post("/send-verification-pin", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Adresse e-mail invalide" });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("send-verification-pin: SMTP_* env vars are not configured.");
    return res.status(500).json({ error: "Envoi d'e-mail non configuré côté serveur" });
  }

  const pin = generatePin();

  try {
    const supabase = getServerSupabase();
    const { error: insertError } = await supabase.from("pins").insert({ email, pin, used: false });
    if (insertError) {
      console.error("send-verification-pin: could not store PIN:", insertError);
      return res.status(500).json({ error: "Impossible de générer le code de confirmation" });
    }

    await transporter.sendMail({
      from: `"SHM Qiadati" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Votre code de confirmation SHM Qiadati",
      html: buildPinEmail(firstName, pin),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("send-verification-pin error:", error);
    res.status(500).json({ error: "Impossible d'envoyer le code de confirmation" });
  }
});

/**
 * POST /api/auth/verify-email-pin
 * Body: { email, pin }
 * Consumes the PIN (single use, 5 min TTL -- same rules as
 * App-membre's handleVerifyPin) and, on success, stamps
 * user_chefs.email_verified_at so /api/auth/login can allow this
 * account in.
 */
router.post("/verify-email-pin", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const pin = typeof req.body?.pin === "string" || typeof req.body?.pin === "number" ? String(req.body.pin).trim() : "";

  if (!email || !pin) {
    return res.status(400).json({ error: "E-mail et code requis" });
  }

  try {
    const supabase = getServerSupabase();

    const { data: entry, error: selectError } = await supabase
      .from("pins")
      .select("id, pin, generated_at, used")
      .eq("email", email)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("verify-email-pin: could not read PIN:", selectError);
      return res.status(500).json({ error: "Impossible de vérifier le code" });
    }
    if (!entry) return res.status(400).json({ error: "Aucun code trouvé pour cet e-mail" });
    if (entry.used) return res.status(400).json({ error: "Ce code a déjà été utilisé" });
    if (new Date(entry.generated_at).getTime() + PIN_TTL_MS <= Date.now()) {
      return res.status(400).json({ error: "Ce code a expiré, demandez-en un nouveau" });
    }
    if (entry.pin !== pin) return res.status(400).json({ error: "Code incorrect" });

    const { data: consumed, error: updateError } = await supabase
      .from("pins")
      .update({ used: true })
      .eq("id", entry.id)
      .eq("used", false)
      .select("id")
      .maybeSingle();

    if (updateError || !consumed) {
      return res.status(400).json({ error: "Ce code a déjà été utilisé" });
    }

    const { error: chefUpdateError } = await supabase
      .from("user_chefs")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("email", email);

    if (chefUpdateError) {
      console.error("verify-email-pin: could not stamp user_chefs:", chefUpdateError);
      return res.status(500).json({ error: "Code valide mais confirmation impossible, contactez un administrateur" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("verify-email-pin error:", error);
    res.status(500).json({ error: "Impossible de vérifier le code" });
  }
});

export default router;
