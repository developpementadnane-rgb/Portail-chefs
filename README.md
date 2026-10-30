# Qiadati

> Plateforme de gestion et de pilotage du réseau SHM destinée aux chefs et responsables de cellules.

**Qiadati** est l'application dédiée aux **chefs** au sein de l'écosystème SHM. Elle permet de centraliser le suivi des cellules, des membres, des activités et des informations nécessaires au pilotage quotidien.

---

## 🌐 L'écosystème SHM

Qiadati s'inscrit dans un écosystème composé de trois applications complémentaires :

| Application | Public cible | Rôle |
|---|---|---|
| **Qiadati** | 👤 Chefs | Gestion, pilotage et suivi des cellules |
| **Mon Rapport** | 🏢 Cellules | Rapports, activités et remontée d'informations |
| **Mon-SHM** | 👥 Membres | Espace personnel et services destinés aux membres |

Les trois applications sont conçues pour fonctionner de manière complémentaire autour d'un même écosystème.

---

## 🎯 Objectifs

Qiadati a pour objectif de fournir aux chefs un espace centralisé permettant de :

- 📊 Suivre l'activité des cellules
- 👥 Consulter et gérer les membres
- 🏢 Suivre les différentes cellules
- 📋 Consulter les rapports et informations remontées
- 📅 Organiser et suivre les activités
- 📈 Visualiser les statistiques importantes
- 🔐 Gérer les accès selon les rôles
- 📱 Utiliser l'application depuis différents appareils

---

## ✨ Fonctionnalités

### Tableau de bord

Le tableau de bord permet d'avoir rapidement une vision globale de la situation :

- statistiques principales ;
- nombre de cellules ;
- nombre de membres ;
- activités ;
- rapports ;
- informations importantes.

### Gestion des cellules

Qiadati permet notamment de :

- consulter les cellules ;
- accéder aux informations d'une cellule ;
- suivre leur activité ;
- consulter les données associées.

### Gestion des membres

Les chefs peuvent accéder aux informations relatives aux membres selon leurs permissions.

### Rapports

L'application est pensée pour exploiter les informations remontées depuis **Mon Rapport** et faciliter leur consultation et leur suivi.

### Authentification

L'accès à l'application est protégé par un système d'authentification et de gestion des rôles.

---

## 🛠️ Technologies

Le projet repose principalement sur :

- **React**
- **TypeScript**
- **Vite**
- **Tailwind CSS**
- **Supabase**
- **Capacitor**
- **Lucide Icons**

### Architecture générale

```text
Qiadati
│
├── React
│   ├── Components
│   ├── Pages
│   ├── Hooks
│   └── Services
│
├── Supabase
│   ├── Authentication
│   ├── Database
│   └── Backend services
│
├── Tailwind CSS
│
└── Capacitor
    └── Android
```

---

## 📁 Structure du projet

```text
Qiadati/
│
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── lib/
│   └── ...
│
├── supabase/
├── android/
├── package.json
├── vite.config.*
├── tailwind.config.*
├── tsconfig.json
└── README.md
```

> La structure exacte peut évoluer avec les prochaines versions du projet.

---

## 🚀 Installation

### Prérequis

Avant de commencer, installer :

- **Node.js**
- **npm**
- **Git**

Puis cloner le dépôt :

```bash
git clone <URL_DU_REPOSITORY>
cd Qiadati
```

Installer les dépendances :

```bash
npm install
```

---

## 💻 Développement

Lancer le serveur de développement :

```bash
npm run dev
```

L'application sera ensuite accessible à l'adresse indiquée par Vite, généralement :

```text
http://localhost:5173
```

---

## 🏗️ Build

Pour générer une version de production :

```bash
npm run build
```

Pour prévisualiser le build :

```bash
npm run preview
```

---

## 🔐 Configuration Supabase

Qiadati utilise **Supabase** pour certaines fonctionnalités backend, notamment l'authentification et la gestion des données.

Créer un fichier `.env` à la racine du projet avec les variables nécessaires :

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### ⚠️ Sécurité

Ne jamais publier de clés privées ou de secrets dans le dépôt GitHub.

Le fichier `.env` doit être ajouté au `.gitignore` :

```gitignore
.env
.env.local
.env.*.local
```

---

## 📱 Application mobile

Le projet utilise **Capacitor** afin de permettre une utilisation sous Android.

Après avoir généré le build :

```bash
npm run build
```

Synchroniser avec Capacitor :

```bash
npx cap sync
```

Puis ouvrir le projet Android :

```bash
npx cap open android
```

La génération et la publication de l'application Android peuvent ensuite être effectuées depuis Android Studio.

---

## 🔑 Authentification et rôles

L'application fonctionne avec un système d'accès basé sur les utilisateurs et leurs rôles.

Les différentes interfaces et fonctionnalités peuvent être adaptées selon les permissions de l'utilisateur connecté.

L'objectif est de garantir que chaque utilisateur accède uniquement aux fonctionnalités qui lui sont destinées.

---

## 🎨 Interface

Qiadati utilise une interface moderne et responsive afin de permettre son utilisation :

- sur ordinateur ;
- sur tablette ;
- sur mobile ;
- dans l'application Android.

L'interface repose principalement sur **Tailwind CSS** et des composants React réutilisables.

---

## 📊 Communication avec l'écosystème SHM

Qiadati constitue la partie **« Chefs »** de l'écosystème.

```text
                    ÉCOSYSTÈME SHM
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
     QIADATI         MON RAPPORT        MON-SHM
      Chefs            Cellules          Membres
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                    Données SHM
```

Chaque application possède un rôle spécifique tout en participant à un même système.

---

## 🧪 Validation

Avant de considérer une version comme stable, vérifier notamment :

- [ ] Authentification
- [ ] Connexion / déconnexion
- [ ] Navigation
- [ ] Tableau de bord
- [ ] Affichage des cellules
- [ ] Affichage des membres
- [ ] Rapports
- [ ] Responsive desktop
- [ ] Responsive mobile
- [ ] Build production
- [ ] Synchronisation Android
- [ ] Permissions et sécurité

---

## 🐛 Débogage

En cas de problème pendant le développement :

```bash
npm run dev
```

Puis consulter :

- la console du navigateur ;
- les erreurs réseau ;
- les logs Supabase ;
- les logs Android/Capacitor pour la version mobile.

Les fichiers de documentation présents dans le projet peuvent également contenir des informations relatives aux corrections et à l'intégration.

---

## 🔄 Workflow recommandé

Pour contribuer au projet :

```bash
git pull
npm install
npm run dev
```

Après modification :

```bash
npm run build
```

Puis vérifier que l'application fonctionne correctement avant de créer un commit.

Exemple :

```bash
git add .
git commit -m "feat: description de la modification"
git push
```

---

## 📌 Roadmap

Les évolutions futures peuvent notamment concerner :

- amélioration du tableau de bord ;
- amélioration de la gestion des cellules ;
- amélioration du suivi des membres ;
- intégration plus poussée avec **Mon Rapport** ;
- intégration avec **Mon-SHM** ;
- notifications ;
- statistiques avancées ;
- amélioration de l'expérience mobile ;
- amélioration des performances.

---

## 🤝 Contribution

Les contributions doivent respecter l'architecture existante du projet.

Avant de proposer une modification importante :

1. comprendre le fonctionnement actuel ;
2. vérifier les composants existants ;
3. éviter les duplications ;
4. tester sur desktop et mobile ;
5. vérifier le build de production.

---

## 📄 Documentation

Le projet contient également plusieurs documents permettant de suivre l'évolution et les corrections effectuées sur l'application.

Ces documents peuvent notamment concerner :

- l'authentification ;
- le dashboard ;
- les corrections de bugs ;
- les améliorations de validation ;
- l'intégration avec Supabase.

---

## 📜 Licence

Projet privé — **SHM**.

Tous droits réservés.

---

## 👨‍💻 Projet

**Qiadati — SHM**

Application de pilotage destinée aux chefs de l'écosystème SHM.
