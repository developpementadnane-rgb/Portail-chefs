# Système d'Authentification SHM - CIN Based

## Vue d'ensemble

Le portail SHM utilise maintenant le **CIN (Carte Nationale d'Identité)** comme identifiant principal à la place de l'email. Cela simplifie le processus d'authentification et garantit une identité unique pour chaque chef.

## Architecture

### Components

1. **AuthService** (`client/lib/authService.ts`)
   - Gère la logique d'authentification
   - Utilise le CIN comme identifiant principal
   - Hash les mots de passe avec SHA256

2. **Database Table** (`user_chefs`)
   - Stocke les profils des chefs
   - CIN est unique et indexé
   - Includes password hash for security

3. **Login/SignUp Pages**
   - Utilise le CIN au lieu de l'email
   - Validation côté client et serveur
   - Messages d'erreur clairs

## Flux d'authentification

### Inscription (Sign Up)

```
1. User remplit le formulaire avec:
   - Nom
   - Prénom
   - Date de naissance (optionnel)
   - CIN (identifiant unique)
   - CAN (code sur la carte)
   - Téléphone
   - Rôle
   - Mot de passe

2. Validation:
   - Tous les champs obligatoires remplis?
   - CIN unique?
   - Mot de passe min 8 caractères?

3. Hash du mot de passe avec SHA256

4. Insertion dans la table user_chefs

5. Redirection vers login
```

### Connexion (Login)

```
1. User entre:
   - CIN
   - Mot de passe

2. Recherche du chef dans user_chefs par CIN

3. Vérification du hash du mot de passe

4. Si OK:
   - Création d'une session locale
   - Sauvegarde dans localStorage
   - Redirection vers dashboard

5. Si erreur:
   - Affichage du message "CIN ou mot de passe incorrect"
```

## Structure de la table `user_chefs`

```sql
- id (UUID)                 -- Identifiant unique
- cin (VARCHAR 20)          -- Numéro de carte nationale (UNIQUE)
- first_name (VARCHAR 100)  -- Prénom
- last_name (VARCHAR 100)   -- Nom
- date_of_birth (DATE)      -- Date de naissance (optionnel)
- can (VARCHAR 20)          -- Code sur la carte
- phone (VARCHAR 20)        -- Numéro de téléphone
- role (VARCHAR 50)         -- Rôle (member, leader, assistant, main)
- password_hash (VARCHAR)   -- Hash du mot de passe
- created_at (TIMESTAMP)    -- Date de création
- updated_at (TIMESTAMP)    -- Date de dernière modification
```

## Sécurité

### Mot de passe
- Hash avec SHA256 (côté client pour demo)
- **IMPORTANT**: En production, utiliser bcrypt sur le serveur backend
- Jamais stocké en plaintext

### CIN
- Unique dans la base de données
- Validé lors de l'inscription
- Index pour recherches rapides

### Session
- Stockée dans localStorage
- Contient: id, cin, firstName, lastName, role
- Pas de mot de passe stocké en session

### Row Level Security (RLS)
- Chaque chef ne peut accéder qu'à ses propres données
- Activé par défaut sur user_chefs

## Utilisation dans l'application

### Get Current Chef
```typescript
import { getCurrentChef } from '../lib/authService';

const chef = getCurrentChef();
console.log(chef.firstName); // Jean
console.log(chef.role);      // main
```

### Check if Logged In
```typescript
import { isChefLoggedIn } from '../lib/authService';

if (isChefLoggedIn()) {
  // User is logged in
}
```

### Logout
```typescript
import { logoutChef } from '../lib/authService';

logoutChef();
// Clears session and localStorage
```

## Migration de l'ancienne authentification

Si vous aviez précédemment utilisé l'authentification par email:

1. Exécuter le script SQL pour créer la table `user_chefs`
2. Optionnel: Migrer les données existantes
3. Mettre à jour les variables de session
4. Tester la nouvelle authentification

## Configuration requise

### .env
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Supabase Database
- Table `user_chefs` créée
- RLS enabled
- Index sur CIN

## Exemple complet

### Inscription
```
Nom: Dupont
Prénom: Jean
Date naissance: 1990-05-15
CIN: AB123456
CAN: 12345
Téléphone: +212612345678
Rôle: Chef principal
Mot de passe: SecurePassword123
```

### Connexion
```
CIN: AB123456
Mot de passe: SecurePassword123
→ Success → Dashboard
```

## Dépannage

### "Ce numéro CIN est déjà enregistré"
- Le CIN existe déjà dans la base de données
- Vérifiez le numéro ou créez un compte différent

### "CIN ou mot de passe incorrect"
- Le CIN n'existe pas OU
- Le mot de passe est incorrect
- Vérifiez les deux

### Pas de session après login
- Vérifier que localStorage fonctionne
- Vérifier que la table user_chefs est bien créée
- Vérifier la connexion Supabase

## Points importants

⚠️ **IMPORTANT**: Cette implémentation utilise SHA256 pour le hachage des mots de passe.
En production, migrer vers bcrypt ou un autre algorithme sécurisé sur le serveur backend.

Pour améliorer la sécurité:
1. Implémenter le hachage des mots de passe sur le serveur
2. Utiliser bcrypt ou argon2
3. Ajouter la validation du CIN (format Marocain)
4. Implémenter la 2FA si nécessaire
5. Ajouter les logs d'accès
6. Implémenter le verrouillage après tentatives échouées
