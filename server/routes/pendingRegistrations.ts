import { Router } from "express";
import { getServerSupabase } from "../lib/supabase";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * GET /api/pending-registrations
 * Liste des demandes d'inscription membres en attente de validation.
 * Tout chef connecté peut consulter (pas de restriction de rôle pour
 * l'instant -- cohérent avec le reste du portail chefs, voir rapport 2).
 */
router.get("/", requireAuth, async (_req, res) => {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("pending_registrations")
      .select(
        "id, generated_id, first_name, last_name, birth_date, gender, user_phone, email, " +
          "patrol_id, role_id, guardian_first_name, guardian_last_name, guardian_relationship, " +
          "guardian_cin, father_phone, mother_phone, home_phone, additional_info, status, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ error: null, data });
  } catch (error) {
    console.error("Erreur liste demandes en attente:", error);
    res.status(500).json({ error: "Erreur serveur", data: null });
  }
});

/**
 * POST /api/pending-registrations/:id/reject
 * Marque la demande comme refusée (garde une trace plutôt que de
 * supprimer directement).
 */
router.post("/:id/reject", requireAuth, async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const chefId = req.user_id;

    const { error } = await supabase
      .from("pending_registrations")
      .update({ status: "rejected", reviewed_by_chef_id: chefId ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("status", "pending");

    if (error) throw error;
    res.json({ error: null });
  } catch (error) {
    console.error("Erreur refus demande:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * DELETE /api/pending-registrations/:id
 * Supprime définitivement une demande déjà traitée (acceptée ou refusée).
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from("pending_registrations")
      .delete()
      .eq("id", req.params.id)
      .neq("status", "pending"); // jamais supprimer une demande encore active

    if (error) throw error;
    res.json({ error: null });
  } catch (error) {
    console.error("Erreur suppression demande:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * POST /api/pending-registrations/:id/accept
 * Transfère la demande vers "users" et renvoie la ligne créée. La
 * génération des documents (QR + carte + fiche) et l'envoi e-mail se
 * font ensuite côté client (voir PendingMembers.tsx), qui a déjà tout
 * ce qu'il faut pour dessiner MemberCard/MemberSheet et produire le PDF
 * via html2canvas -- pas besoin de dupliquer ce rendu côté serveur.
 */
router.post("/:id/accept", requireAuth, async (req, res) => {
  try {
    const supabase = getServerSupabase();
    const chefId = req.user_id;

    const { data: pending, error: fetchError } = await supabase
      .from("pending_registrations")
      .select("*")
      .eq("id", req.params.id)
      .eq("status", "pending")
      .single();

    if (fetchError || !pending) {
      return res.status(404).json({ error: "Demande introuvable ou déjà traitée", data: null });
    }

    const { password: _password, status: _status, id: _id, reviewed_by_chef_id: _r, reviewed_at: _ra, created_at: _ca, updated_at: _ua, email_verified: _ev, ...memberFields } = pending;

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([{ ...memberFields, password: pending.password }])
      .select()
      .single();

    if (insertError || !newUser) {
      console.error("Erreur transfert vers users:", insertError);
      return res.status(400).json({ error: insertError?.message || "Échec du transfert", data: null });
    }

    const { error: updateError } = await supabase
      .from("pending_registrations")
      .update({ status: "accepted", reviewed_by_chef_id: chefId ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", req.params.id);

    if (updateError) {
      console.error("Erreur mise à jour statut demande (non bloquant):", updateError);
    }

    res.json({ error: null, data: newUser });
  } catch (error) {
    console.error("Erreur acceptation demande:", error);
    res.status(500).json({ error: "Erreur serveur", data: null });
  }
});

export default router;
