# Build Android (.apk) via GitHub Actions

Ce document explique comment obtenir un fichier `.apk` installable de
Qada, sans installer Android Studio ni le SDK Android sur votre
machine — tout se fait automatiquement sur les serveurs GitHub à
chaque `git push`.

## Comment ça marche

L'application Android n'est PAS une réécriture native : c'est une
coquille (Capacitor) qui charge le site web Qada déjà déployé sur
Netlify, à l'intérieur d'une WebView Android. Concrètement :

- Il n'y a qu'UNE SEULE version de l'application à maintenir : le site
  web déployé sur Netlify. L'APK ne fait que l'afficher dans une
  fenêtre native.
- Toute la logique hors ligne (membres en cache, présences en file
  d'attente, synchronisation) fonctionne à l'identique dans l'APK et
  dans un navigateur mobile — voir `client/lib/offline/`.
- Corriger un bug ou ajouter une fonctionnalité ne nécessite PAS de
  reconstruire l'APK à chaque fois : un déploiement Netlify suffit,
  et l'APK déjà installé sur les téléphones des chefs affichera la
  nouvelle version au prochain lancement avec connexion.
- Reconstruire l'APK n'est nécessaire que si vous changez : l'icône,
  le nom de l'app, les permissions Android, ou l'URL de production
  elle-même.

## Étape 1 — Déployer le site web sur Netlify

Si ce n'est pas déjà fait, connectez ce dépôt GitHub à Netlify (ou
gardez votre déploiement existant). Notez l'URL finale, par exemple
`https://portail-shm.netlify.app`.

## Étape 2 — Configurer les secrets GitHub

Dans votre dépôt GitHub : **Settings → Secrets and variables →
Actions → New repository secret**. Ajoutez :

| Secret | Valeur | Obligatoire |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de votre projet Supabase | Oui |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme Supabase (publique, pas la service role) | Oui |
| `QADA_PRODUCTION_URL` | L'URL Netlify de l'étape 1, ex. `https://portail-shm.netlify.app` | Oui — sans ça, le build Android échoue volontairement |
| `VITE_MEMBERS_PORTAL_URL` | URL du portail membre (pour les QR codes de présence) | Recommandé |

**Ne mettez jamais** `SUPABASE_SERVICE_ROLE_KEY` dans les secrets du
job Android/web front-end — cette clé reste réservée aux variables
d'environnement du serveur Netlify Functions, configurées séparément
dans les réglages Netlify (Site settings → Environment variables), pas
dans GitHub Actions.

### Signature de l'APK (optionnel mais recommandé)

Sans configuration supplémentaire, le workflow produit un **APK signé
en mode debug** — installable et pleinement fonctionnel pour un usage
interne à l'équipe, mais pas publiable sur le Play Store tel quel.

Pour une signature de production (release), générez d'abord un
keystore localement :

```bash
keytool -genkeypair -v -keystore release.keystore -alias qada \
  -keyalg RSA -keysize 2048 -validity 10000
```

Puis ajoutez ces secrets supplémentaires :

| Secret | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i release.keystore \| pbcopy` (ou équivalent) |
| `ANDROID_KEYSTORE_PASSWORD` | Le mot de passe choisi au `keytool` |
| `ANDROID_KEY_ALIAS` | `qada` (ou l'alias choisi) |
| `ANDROID_KEY_PASSWORD` | Le mot de passe de la clé |

**Conservez ce fichier `release.keystore` en lieu sûr, hors de Git.**
Le perdre signifie ne plus jamais pouvoir publier de mise à jour sous
la même identité d'application.

## Étape 3 — Pousser vers GitHub

```bash
git init                          # si ce n'est pas déjà un dépôt Git
git add .
git commit -m "Qada v2.0 — offline support + Android build"
git remote add origin <url-de-votre-depot>
git push -u origin main
```

Le workflow (`.github/workflows/build.yml`) se déclenche automatiquement
sur push vers `main`.

## Étape 4 — Récupérer l'APK

1. Allez sur l'onglet **Actions** de votre dépôt GitHub
2. Cliquez sur le run le plus récent du workflow "Build"
3. Attendez que le job **Android (.apk)** se termine (≈5-10 minutes,
   le SDK Android + Gradle se téléchargent à chaque run)
4. En bas de la page du run, section **Artifacts** : téléchargez
   `qada-<version>.apk`
5. Transférez ce fichier sur un téléphone Android et ouvrez-le pour
   l'installer (il faudra probablement autoriser "Installer des
   applications inconnues" pour la source utilisée — navigateur,
   gestionnaire de fichiers, etc.)

Vous pouvez aussi déclencher un build manuellement sans attendre un
push : onglet **Actions → Build → Run workflow**.

## Icône de l'application

L'icône actuelle (`android/app/src/main/res/drawable/ic_launcher_*.xml`)
est un **placeholder générique** — ce dépôt ne contenait pas de logo
SHM en vecteur ou haute résolution, seulement un `favicon.ico`
insuffisant pour une icône de lanceur Android correcte. Pour la
remplacer par le vrai logo :

1. Exportez le logo SHM en SVG ou PNG haute résolution (au moins
   512×512)
2. Utilisez [Android Studio's Image Asset Studio](https://developer.android.com/studio/write/image-asset-studio)
   ou [icon.kitchen](https://icon.kitchen) pour générer un jeu complet
   d'icônes adaptatives
3. Remplacez les fichiers dans `android/app/src/main/res/drawable/` et
   `mipmap-anydpi-v26/`

## Limites connues

- **Pas de push notifications** : non implémenté dans cette version
  (hors périmètre de la stratégie offline v2.0).
- **Pas de mise à jour automatique via Play Store** : l'APK est
  distribué manuellement (ou via un canal interne comme Firebase App
  Distribution, non configuré ici). Une future itération pourrait
  ajouter cela si la distribution devient un problème réel.
- **iOS non couvert** : cette configuration Capacitor ne génère qu'un
  projet Android. Ajouter iOS suivrait le même principe
  (`npx cap add ios`) mais nécessite un Mac pour la compilation finale
  — GitHub Actions propose des runners macOS si ce besoin apparaît.
