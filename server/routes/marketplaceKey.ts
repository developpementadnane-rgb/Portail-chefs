import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getServerSupabase } from "../lib/supabase";
import {
  generateRawMarketplaceKey,
  hashMarketplaceKey,
  encryptMarketplaceKey,
  decryptMarketplaceKey,
} from "../lib/marketplaceKeyCrypto";

/**
 * Bloc "Clé secrète pour la marketplace" du dashboard chefs.
 *
 * Principes (repris du SQL fourni par Builder) :
 * - une seule clé "active" à la fois, jamais réutilisée ;
 * - expiration à 24h ;
 * - les anciennes clés sont marquées "expired", jamais supprimées (audit) ;
 * - la comparaison de la clé par le site marketplace se fait TOUJOURS côté
 *   serveur de ce site, sur `key_hash` -- jamais dans un navigateur.
 *
 * Ce fichier ne fait qu'AFFICHER la clé en clair à un chef déjà authentifié
 * (requireAuth), via `key_ciphertext` (déchiffré ici, jamais envoyé au
 * marketplace). Génération "à la demande" : si la clé active a expiré ou
 * n'existe pas encore, on en crée une nouvelle avant de répondre -- pas
 * besoin de pg_cron pour ce cas d'usage.
 */

const TABLE = "admin_access_keys";
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const admin = getServerSupabase();

    const { data: active, error: fetchError } = await admin
      .from(TABLE)
      .select("id, key_ciphertext, expires_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const stillValid = active && new Date(active.expires_at).getTime() > Date.now();

    if (stillValid && active.key_ciphertext) {
      return res.json({
        key: decryptMarketplaceKey(active.key_ciphertext),
        expiresAt: active.expires_at,
      });
    }

    // Pas de clé active valide : on en génère une nouvelle et on marque
    // l'ancienne (le cas échéant) comme expirée, sans jamais la supprimer.
    if (active) {
      const { error: expireError } = await admin
        .from(TABLE)
        .update({ status: "expired", expired_at: new Date().toISOString() })
        .eq("id", active.id);
      if (expireError) throw expireError;
    }

    const rawKey = generateRawMarketplaceKey();
    const expiresAt = new Date(Date.now() + KEY_TTL_MS).toISOString();

    const { error: insertError } = await admin.from(TABLE).insert({
      key_hash: Array.from(hashMarketplaceKey(rawKey)), // bytea via array d'octets
      key_ciphertext: encryptMarketplaceKey(rawKey),
      status: "active",
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    return res.json({ key: rawKey, expiresAt });
  } catch (error) {
    console.error("Erreur clé marketplace :", error);
    return res.status(500).json({ error: "Impossible de récupérer la clé marketplace." });
  }
});

export default router;
