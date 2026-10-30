import { Router } from "express";
import nodemailer from "nodemailer";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface AttachmentPayload {
  filename: string;
  /** PDF/PNG encodé en base64 (sans le préfixe data:...;base64,), généré côté client. */
  base64: string;
  contentType: string;
}

/**
 * POST /api/members/send-documents
 * Body: { to, firstName, lastName, birthDate, generatedId, attachments: AttachmentPayload[] }
 * Envoie au membre fraîchement authentifié ses 3 documents (fiche
 * d'adhésion PDF, carte PDF, QR code image) en pièces jointes, générés
 * côté client juste avant cet appel (voir PendingRegistrations.tsx).
 */
router.post("/send-documents", requireAuth, async (req, res) => {
  const { to, firstName, lastName, birthDate, generatedId, attachments } = req.body ?? {};

  if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "Adresse e-mail destinataire invalide" });
  }
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return res.status(400).json({ error: "Aucun document à envoyer" });
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("send-documents: SMTP_* env vars are not configured.");
    return res.status(500).json({ error: "Envoi d'e-mail non configuré côté serveur" });
  }

  try {
    const mailAttachments = (attachments as AttachmentPayload[]).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.base64, "base64"),
      contentType: a.contentType,
    }));

    const safeFirst = escapeHtml(firstName);
    const safeLast = escapeHtml(lastName);
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f7;padding:20px}.card{max-width:600px;margin:auto;background:#fff;border-radius:8px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}h1{color:#2c3e50;font-size:20px}p{color:#444;line-height:1.5}.id{display:inline-block;margin:8px 0;padding:6px 14px;font-weight:bold;color:#fff;background:#2c3e50;border-radius:4px}
</style></head><body><div class="card">
<h1>Votre compte a été authentifié ✅</h1>
<p>Bonjour ${safeFirst} ${safeLast},</p>
<p>Votre inscription a été validée par un chef. Vous pouvez maintenant vous connecter.</p>
<p>Identifiant : <span class="id">${escapeHtml(generatedId)}</span></p>
<p>Date de naissance : ${escapeHtml(birthDate)}</p>
<p>Vous trouverez en pièces jointes votre fiche d'adhésion, votre carte et votre QR code.</p>
</div></body></html>`;

    await transporter.sendMail({
      from: `"SHM — Portail Membres" <${process.env.SMTP_USER}>`,
      to,
      subject: "Votre compte a été authentifié",
      html,
      attachments: mailAttachments,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("send-documents error:", error);
    res.status(500).json({ error: "Impossible d'envoyer les documents" });
  }
});

export default router;
