# Portail Chefs — état au 30/10/2026

## Ce qui a changé par rapport au dépôt d'origine

### 1. Session "Se souvenir de moi" (21 jours)
Avant : le token expirait après 12h, fixe, sans option. C'était la cause
de la déconnexion automatique signalée.
Maintenant : case à cocher sur la page de connexion. Cochée → token valable
21 jours. Non cochée → comportement inchangé (12h).
Fichiers : server/routes/auth.ts, client/pages/Login.tsx, client/lib/authService.ts

### 2. Inscription chefs par code de vérification (bloc 4)
Nouveau champ "Code de vérification" (format 123-456/78) à l'inscription,
vérifié contre la table chefs_whitelist (nom + prénom doivent correspondre).
Fichiers : server/routes/auth.ts, client/pages/SignUp.tsx, client/lib/authService.ts
⚠️ Codes de TEST encore en base (123-456/78 et 987-654/32) — le vrai CSV
n'a pas encore été fourni. Voir section CSV plus bas.

### 3. Demandes d'inscription membres en attente (bloc 3 + 5)
Nouvelle page "Demandes en attente" dans le menu. Le chef voit chaque
demande, peut Authentifier (transfert vers users + génération QR/carte/
fiche + envoi email) ou Refuser (trace gardée, pas supprimée).
Fichiers nouveaux : server/routes/pendingRegistrations.ts,
server/routes/sendMemberDocuments.ts, client/pages/PendingRegistrations.tsx,
client/components/MemberCard.tsx, client/components/MemberSheet.tsx,
client/lib/cardConfig.ts, public/card/*.jpg,*.png
Dépendances ajoutées dans package.json : html2canvas, jspdf

## ⚠️ Ce qui est resté CASSÉ depuis le nettoyage de base du 30/10/2026

7 tables ont été supprimées sur ta demande explicite : attendance,
attendance_records, attendance_sync_log, trusted_devices,
team_access_passphrase, team_access_tokens, password_reset_tokens.

Le code suivant les référence encore et VA PLANTER à l'usage :
- server/routes/attendance.ts (scan de présence QR/PIN)
- client/pages/AttendanceScan.tsx
- server/middleware/requireOfflineAccess.ts (accès terrain hors-ligne)
- client/lib/offline/teamAccess.ts
- docs/MIGRATION_BADGE_SCAN.sql (obsolète, ne plus appliquer)

Ces fichiers N'ONT PAS été retirés ni corrigés dans cette livraison — tu
avais dit de les laisser de côté pour l'instant (sécurité/présence
repoussée à plus tard). Le site fonctionnera normalement SAUF si quelqu'un
clique sur "Scanner présence" ou "Page d'urgence" / accès hors-ligne.

## À faire côté Adnane
- Fournir le vrai CSV chefs (colonnes : code, first_name, last_name, phone,
  email) pour remplacer les 2 codes de test dans chefs_whitelist
- Tester le flux "Demandes en attente" de bout en bout (génération PDF
  réelle jamais testée en conditions réelles)
- Vérifier que VITE_BADGE_ENCRYPTION_KEY est bien définie en env (sinon
  la génération de QR échoue silencieusement à l'acceptation)
