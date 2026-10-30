/**
 * TOTP (RFC 6238) — implémentation minimale, sans dépendance externe.
 *
 * Pourquoi pas une lib tierce (speakeasy, otpauth...) : le projet
 * fait déjà toute sa crypto (deviceTrust.ts) avec le module `crypto`
 * natif de Node, sans dépendance ajoutée. TOTP est simple à
 * implémenter correctement (HMAC + troncature dynamique, ~40 lignes
 * utiles) et rester cohérent avec ce style évite d'introduire une
 * dépendance de plus pour un besoin déjà couvert par crypto natif.
 *
 * Usage dans ce projet — flux attendance QR/PIN :
 *   1. Le chef crée un challenge : generateTotpSecret() produit un
 *      secret aléatoire, stocké CHIFFRÉ (pas juste hashé — on doit
 *      pouvoir le relire pour recalculer le code) sur
 *      attendance_challenges.totp_secret_encrypted.
 *   2. Le QR encode ce secret en clair, une seule fois, au moment du
 *      scan (pas un code qui tourne — le secret lui-même).
 *   3. Le portail membre calcule localement generateTotpCode(secret)
 *      pour vérifier immédiatement que le QR "est vivant", sans
 *      jamais contacter le serveur à cet instant — c'est le
 *      fonctionnement offline recherché (même principe que Google
 *      Authenticator : les deux parties partagent un secret, chacune
 *      calcule le code indépendamment à partir de l'heure courante).
 *   4. Quand le membre retrouve une connexion, il envoie le code
 *      qu'il a calculé (+ son horodatage local) au serveur, qui
 *      déchiffre le secret stocké et recalcule lui-même le code pour
 *      la fenêtre de temps correspondante — verifyTotpCode() gère
 *      cette comparaison avec une tolérance de dérive.
 */

import crypto from "crypto";

const DEFAULT_PERIOD_SECONDS = 30;
const DEFAULT_DIGITS = 6;

/**
 * Génère un secret TOTP aléatoire (20 bytes, la taille recommandée
 * par la RFC pour HMAC-SHA1), encodé en Base32 — le format standard
 * attendu par TOTP, plus compact et sans ambiguïté visuelle qu'un
 * hex brut dans un QR code.
 */
export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Calcule le code TOTP courant (ou pour un timestamp donné, utile
 * pour les tests et pour verifyTotpCode ci-dessous) à partir d'un
 * secret Base32.
 */
export function generateTotpCode(
  secretBase32: string,
  options: { period?: number; digits?: number; atTimeMs?: number } = {},
): string {
  const period = options.period ?? DEFAULT_PERIOD_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const atTimeMs = options.atTimeMs ?? Date.now();

  const counter = Math.floor(atTimeMs / 1000 / period);
  return computeHotp(base32Decode(secretBase32), counter, digits);
}

/**
 * Vérifie un code TOTP présenté par un membre contre le secret
 * stocké côté serveur, avec une fenêtre de tolérance (le device du
 * membre a pu calculer le code un peu avant/après la synchronisation
 * réelle avec le serveur — normal en usage offline différé, où le
 * code a été calculé au moment du scan mais n'est envoyé au serveur
 * que plus tard). windowSteps=1 accepte la fenêtre courante ± 1
 * période (donc jusqu'à ~30s d'écart d'horloge/de délai réseau).
 *
 * Ceci ne remplace PAS la fenêtre de validité globale du challenge
 * (expires_at, ex. 10 minutes) — c'est une tolérance fine de
 * quelques dizaines de secondes pour absorber la latence de calcul,
 * pas un blanc-seing sur toute la durée du challenge.
 */
export function verifyTotpCode(
  secretBase32: string,
  presentedCode: string,
  options: { period?: number; digits?: number; atTimeMs?: number; windowSteps?: number } = {},
): boolean {
  const period = options.period ?? DEFAULT_PERIOD_SECONDS;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const atTimeMs = options.atTimeMs ?? Date.now();
  const windowSteps = options.windowSteps ?? 1;

  const normalizedPresented = presentedCode.trim();
  if (!/^\d+$/.test(normalizedPresented)) return false;

  for (let stepOffset = -windowSteps; stepOffset <= windowSteps; stepOffset++) {
    const candidateTimeMs = atTimeMs + stepOffset * period * 1000;
    const expected = generateTotpCode(secretBase32, { period, digits, atTimeMs: candidateTimeMs });
    if (timingSafeEqual(expected, normalizedPresented)) return true;
  }
  return false;
}

// ============================================================
// Primitives internes
// ============================================================

function computeHotp(secretBytes: Buffer, counter: number, digits: number): string {
  const counterBuffer = Buffer.alloc(8);
  // RFC 4226 : compteur 64 bits big-endian.
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter % 2 ** 32, 4);

  const hmac = crypto.createHmac("sha1", secretBytes).update(counterBuffer).digest();

  // Troncature dynamique (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const modulo = 10 ** digits;
  return String(binaryCode % modulo).padStart(digits, "0");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Buffer): string {
  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder !== 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const char of cleaned) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) throw new Error(`Caractère Base32 invalide: ${char}`);
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// ============================================================
// Chiffrement réversible du secret (AES-256-GCM)
// ============================================================
// Le secret TOTP doit être stocké de façon RÉVERSIBLE côté serveur
// (contrairement à un mot de passe) car la vérification nécessite de
// le relire pour recalculer le code attendu. Un simple hash SHA256
// (comme token_hash/pin_hash sur attendance_challenges) ne
// conviendrait pas ici — on ne peut pas "recalculer" un secret à
// partir de son hash. AES-256-GCM avec IV aléatoire par valeur donne
// confidentialité + intégrité (tag d'authentification), avec
// TOTP_ENCRYPTION_KEY comme clé maître (32 bytes, distincte de
// JWT_SECRET et DEVICE_TOKEN_SECRET pour permettre une rotation
// indépendante).

function getEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY manquante. Générer avec: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY doit être 32 bytes (64 caractères hex).");
  }
  return key;
}

/**
 * Chiffre le secret TOTP pour stockage en base. Format de sortie:
 * "iv_hex:authTag_hex:ciphertext_hex" — tout est nécessaire au
 * déchiffrement, rien n'est secret dans ce format en soi (la clé
 * elle seule protège), donc pas de souci à le stocker tel quel dans
 * une colonne text.
 */
export function encryptTotpSecret(secretBase32: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits, recommandé pour GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptTotpSecret(encryptedValue: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = encryptedValue.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Format de secret TOTP chiffré invalide.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
