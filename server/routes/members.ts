import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { getServerSupabase } from "../lib/supabase";

const router = Router();

/**
 * Fields a chef is allowed to edit from "Gestion de l'adhésion" /
 * MemberDetail's generic "Modifier" action. Deliberately excludes:
 *   - id, generated_id, created_at, updated_at (system-managed)
 *   - pdf_url, qr_code_url, documents_generated_at (only ever written
 *     by the badge/PDF generation flow in the members portal -- see
 *     App-membre's routes/auth.ts handleSavePdfQrCode)
 *   - patrol_name, role_name (joined/denormalized display fields, not
 *     raw editable columns on member_profiles)
 *   - payment_completed, documents_completed (live on `users`, not
 *     member_profiles -- already editable via /api/membership/update,
 *     see routes/membership.ts)
 * If your real schema also exposes editable patrol_id/role_id foreign
 * keys, add them here once confirmed against the live Supabase table
 * (see the note in routes/membership.ts about the schema having
 * drifted from what the docs describe before).
 */
const updateSchema = z
  .object({
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().min(1).optional(),
    birth_date: z.string().trim().min(1).nullable().optional(),
    gender: z.string().trim().min(1).nullable().optional(),
    is_high_patrol: z.boolean().optional(),
    user_phone: z.string().trim().nullable().optional(),
    guardian_first_name: z.string().trim().nullable().optional(),
    guardian_last_name: z.string().trim().nullable().optional(),
    guardian_relationship: z.string().trim().nullable().optional(),
    guardian_cin: z.string().trim().nullable().optional(),
    father_phone: z.string().trim().nullable().optional(),
    mother_phone: z.string().trim().nullable().optional(),
    home_phone: z.string().trim().nullable().optional(),
    additional_info: z.string().trim().nullable().optional(),
  })
  .strict();

/**
 * PATCH /api/members/:id
 *
 * Generic "Modifier" action for a member's own file (as opposed to
 * /api/membership/update, which only toggles payment/documents).
 */
router.patch("/:id", requireAuth, async (req, res) => {
  const memberId = req.params.id;
  if (!memberId || !z.string().uuid().safeParse(memberId).success) {
    return res.status(400).json({ error: "Identifiant de membre invalide" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Champs invalides", details: parsed.error.flatten() });
  }

  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: "Aucune modification à enregistrer" });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("member_profiles")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", memberId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Member update error:", error);
      return res.status(500).json({ error: "Impossible d'enregistrer la modification" });
    }

    if (!data) {
      return res.status(404).json({ error: "Membre introuvable" });
    }

    res.json({ success: true, member: data });
  } catch (error) {
    console.error("Member update error:", error);
    res.status(500).json({ error: "Impossible d'enregistrer la modification" });
  }
});

/**
 * DELETE /api/members/:id
 *
 * Irreversible. Removes the member's profile AND the linked `users`
 * row (login + payment_completed/documents_completed), since both
 * represent the same person shared with the members portal -- see
 * membersCache.ts's note that membership status lives on a separate
 * `users` row keyed by the same id. Deleting only one side would
 * leave an orphaned login the member could still use, or an orphaned
 * profile with no way to log in.
 *
 * member_profiles is referenced with ON DELETE CASCADE from
 * attendance-type tables (see docs/OFFLINE_SUPABASE_MIGRATIONS.sql),
 * so deleting the profile also cleans up that member's attendance
 * history automatically.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const memberId = req.params.id;
  if (!memberId || !z.string().uuid().safeParse(memberId).success) {
    return res.status(400).json({ error: "Identifiant de membre invalide" });
  }

  try {
    const supabase = getServerSupabase();

    const { error: profileError } = await supabase
      .from("member_profiles")
      .delete()
      .eq("id", memberId);

    if (profileError) {
      console.error("Member delete error (member_profiles):", profileError);
      return res.status(500).json({ error: "Impossible de supprimer ce membre" });
    }

    // Best-effort: also remove the linked login/membership-status row.
    // Not fatal if it doesn't exist or errors -- the profile is
    // already gone, which is the main thing the chef asked for.
    const { error: userError } = await supabase.from("users").delete().eq("id", memberId);
    if (userError) {
      console.error("Member delete warning (users row not removed):", userError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Member delete error:", error);
    res.status(500).json({ error: "Impossible de supprimer ce membre" });
  }
});

export default router;
