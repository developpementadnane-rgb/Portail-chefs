import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { getServerSupabase } from "../lib/supabase";

const router = Router();

/**
 * GET /api/membership/list
 *
 * One row per member with their payment/documents status, for the
 * chef-facing "affichage adhésion" list + filters.
 *
 * NOTE: an earlier version of this route assumed a richer
 * membership_periods/membership_status_view schema (yearly history,
 * a get_or_create RPC, etc.) mirroring a migration file found in the
 * members portal's repo. A real schema dump showed that migration was
 * never actually applied to the live database -- the real table only
 * has two flat boolean columns directly on `users`, with no year
 * history. This route reflects the REAL schema.
 */
router.get("/list", requireAuth, async (_req, res) => {
  const supabase = getServerSupabase();

  try {
    const { data: members, error } = await supabase
      .from("users")
      .select("id, generated_id, first_name, last_name, payment_completed, documents_completed")
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true });

    if (error) {
      console.error("Membership list error:", error);
      return res.status(500).json({ error: "Impossible de charger les membres" });
    }

    res.json({ members: members ?? [] });
  } catch (error) {
    console.error("Membership list error:", error);
    res.status(500).json({ error: "Impossible de charger les membres" });
  }
});

const updateSchema = z.object({
  member_id: z.string().uuid(),
  payment_completed: z.boolean().optional(),
  documents_completed: z.boolean().optional(),
});

/**
 * POST /api/membership/update
 *
 * Chef-facing manual toggle for the "gestion adhésion" page. Directly
 * updates the two boolean columns on `users` -- no period/history
 * table exists in the real schema, so there is nothing to lazily
 * create first.
 */
router.post("/update", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { member_id: memberId, payment_completed: paymentCompleted, documents_completed: documentsCompleted } = parsed.data;

  if (paymentCompleted === undefined && documentsCompleted === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const updates: Record<string, boolean> = {};
  if (paymentCompleted !== undefined) updates.payment_completed = paymentCompleted;
  if (documentsCompleted !== undefined) updates.documents_completed = documentsCompleted;

  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("users").update(updates).eq("id", memberId);

    if (error) {
      console.error("Membership update error:", error);
      return res.status(500).json({ error: "Impossible d'enregistrer la modification" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Membership update error:", error);
    res.status(500).json({ error: "Impossible d'enregistrer la modification" });
  }
});

export default router;
