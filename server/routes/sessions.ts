import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { getServerSupabase } from "../lib/supabase";

const router = Router();

const createSessionSchema = z.object({
  title: z.string().trim().min(1),
  date_time: z.string().min(1),
  location: z.string().trim().min(1),
  target_audience: z.string().trim().optional(),
  objective: z.string().trim().optional(),
  methodology: z.string().trim().optional(),
  logos: z.array(z.string().url()).max(3).default([]),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Les champs Quoi?, Où? et Quand? sont obligatoires" });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        ...parsed.data,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Session creation error:", error);
      return res.status(500).json({ error: "Erreur lors de l'enregistrement de la séance" });
    }

    return res.status(201).json({ data });
  } catch (error) {
    console.error("Session creation error:", error);
    return res.status(500).json({ error: "Erreur lors de l'enregistrement de la séance" });
  }
});

export default router;
