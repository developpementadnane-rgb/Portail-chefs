// Chiffrement/déchiffrement de la clé marketplace en clair, pour affichage
// dashboard uniquement. Le hash (public.admin_access_keys.key_hash) reste
// l'unique élément utilisé par le site marketplace pour vérifier la clé :
// cette fonction ne sert JAMAIS à la vérification, seulement à la ré-afficher
// à un chef déjà authentifié.
//
// Variable d'environnement requise (Netlify, jamais committée) :
//   MARKETPLACE_KEY_ENCRYPTION_SECRET = 64 caractères hexadécimaux (32 octets)
//   Génération locale : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer {
  const hex = process.env.MARKETPLACE_KEY_ENCRYPTION_SECRET;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "MARKETPLACE_KEY_ENCRYPTION_SECRET manquante ou invalide (64 caractères hex attendus).",
    );
  }
  return Buffer.from(hex, "hex");
}

/** Génère une nouvelle clé marketplace en clair (32 octets -> 64 caractères hex). */
export function generateRawMarketplaceKey(): string {
  return randomBytes(32).toString("hex");
}

/** Hash à sens unique stocké dans admin_access_keys.key_hash (comparaison côté marketplace). */
export function hashMarketplaceKey(rawKey: string): Buffer {
  return createHash("sha256").update(rawKey, "utf8").digest();
}

/** Chiffrement réversible pour ré-affichage dashboard (admin_access_keys.key_ciphertext). */
export function encryptMarketplaceKey(rawKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // format stocké : iv(12) + authTag(16) + ciphertext, en base64
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptMarketplaceKey(ciphertextB64: string): string {
  const raw = Buffer.from(ciphertextB64, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
