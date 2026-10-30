import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { getServerSupabase } from "../lib/supabase";

/**
 * Même galerie partagée que App-membre (table galerie_medias, bucket
 * Storage "galerie" -- même projet Supabase). Ce fichier ajoute ce que
 * la version membre n'a pas : suppression de N'IMPORTE QUELLE
 * publication (modération par un chef), pas seulement les siennes.
 */

const GALLERY_BUCKET = "galerie";
const MAX_BASE64_LENGTH = 70_000_000;

const ALLOWED_MIME: Record<string, { ext: string; type: "image" | "video" }> = {
  "image/jpeg": { ext: "jpg", type: "image" },
  "image/png": { ext: "png", type: "image" },
  "image/webp": { ext: "webp", type: "image" },
  "image/gif": { ext: "gif", type: "image" },
  "video/mp4": { ext: "mp4", type: "video" },
  "video/quicktime": { ext: "mov", type: "video" },
  "video/webm": { ext: "webm", type: "video" },
};

function decodeMediaDataUrl(value: unknown): { buffer: Buffer; mime: string; ext: string; mediaType: "image" | "video" } {
  if (typeof value !== "string") throw new Error("Fichier manquant ou invalide.");
  const [header, base64] = value.split(",", 2);
  const mimeMatch = /^data:([^;]+);base64$/.exec(header ?? "");
  if (!mimeMatch || !base64) throw new Error("Format de fichier invalide (data URL attendue).");
  const mime = mimeMatch[1];
  const known = ALLOWED_MIME[mime];
  if (!known) throw new Error(`Type de fichier non supporté : ${mime}. Formats acceptés : JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM.`);
  if (base64.length > MAX_BASE64_LENGTH) throw new Error("Fichier trop volumineux (50 Mo maximum).");
  return { buffer: Buffer.from(base64, "base64"), mime, ext: known.ext, mediaType: known.type };
}

async function ensureBucket(admin: ReturnType<typeof getServerSupabase>) {
  const { data: bucket, error: bucketError } = await admin.storage.getBucket(GALLERY_BUCKET);
  if (bucket) return;
  if (bucketError && bucketError.statusCode !== "404") throw bucketError;
  const { error: createError } = await admin.storage.createBucket(GALLERY_BUCKET, {
    public: true,
    fileSizeLimit: "50MB",
  });
  if (createError && createError.statusCode !== "409") throw createError;
}

const router = Router();

/** GET /api/gallery -- même liste que côté membres, newest first. */
router.get("/", requireAuth, async (_req, res) => {
  try {
    const admin = getServerSupabase();
    const { data, error } = await admin
      .from("galerie_medias")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    res.json({ media: data ?? [] });
  } catch (error) {
    console.error("Gallery list error:", error);
    res.status(500).json({ error: "Impossible de charger la galerie" });
  }
});

/** POST /api/gallery -- un chef peut aussi publier. */
router.post("/", requireAuth, async (req, res) => {
  const chefId = req.user_id;
  if (!chefId) return res.status(401).json({ error: "Unauthorized" });
  const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 500) : null;

  try {
    const { buffer, mime, ext, mediaType } = decodeMediaDataUrl(req.body?.mediaDataUrl);
    const admin = getServerSupabase();
    await ensureBucket(admin);

    const { data: chef, error: chefError } = await admin
      .from("user_chefs")
      .select("first_name, last_name")
      .eq("id", chefId)
      .maybeSingle();
    if (chefError) throw chefError;

    const path = `chef-${chefId}/${Date.now()}-${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from(GALLERY_BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (uploadError) {
      console.error("Gallery upload error:", uploadError);
      return res.status(400).json({ error: "Échec de l'envoi du fichier" });
    }

    const { data: urlData } = admin.storage.from(GALLERY_BUCKET).getPublicUrl(path);

    const { data: row, error: insertError } = await admin
      .from("galerie_medias")
      .insert({
        media_url: urlData.publicUrl,
        media_type: mediaType,
        description,
        user_id: chefId,
        first_name: chef?.first_name ?? null,
        last_name: chef?.last_name ?? null,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    res.json({ success: true, media: row });
  } catch (error) {
    console.error("Gallery upload error:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Échec de l'envoi" });
  }
});

/**
 * DELETE /api/gallery/:id -- modération : un chef peut supprimer
 * N'IMPORTE QUELLE publication (membre ou chef), pas seulement les siennes.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const admin = getServerSupabase();
    const { data: existing, error: fetchError } = await admin
      .from("galerie_medias")
      .select("id, media_url")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: "Publication introuvable" });

    const path = existing.media_url.split(`/${GALLERY_BUCKET}/`)[1];
    if (path) await admin.storage.from(GALLERY_BUCKET).remove([path]);

    const { error: deleteError } = await admin.from("galerie_medias").delete().eq("id", id);
    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (error) {
    console.error("Gallery delete error:", error);
    res.status(500).json({ error: "Impossible de supprimer cette publication" });
  }
});

export default router;
