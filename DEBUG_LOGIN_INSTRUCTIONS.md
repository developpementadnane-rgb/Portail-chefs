# Instructions de Débogage - Problème de Login

## Étape 1: Vérifier les données dans Supabase

Exécutez ce SQL dans **Supabase > SQL Editor** pour voir TOUS les utilisateurs:

```sql
SELECT 
  id,
  cin,
  first_name,
  last_name,
  password_hash,
  created_at
FROM public.user_chefs
ORDER BY created_at DESC;
```

**Notez:**
- Le `cin` exact (avec espaces?)
- Le `first_name` exact
- Le `last_name` exact
- Vérifiez qu'un `password_hash` existe

---

## Étape 2: Ouvrir la console du navigateur

1. Appuyez sur **F12** ou **Ctrl+Shift+I** (Windows) / **Cmd+Shift+I** (Mac)
2. Allez dans l'onglet **Console**
3. Ce qui s'affiche est crucial pour déboguer

---

## Étape 3: Tester la connexion et NOTER LES LOGS

Allez sur `/login` et:

1. **Entrez EXACTEMENT les données de Supabase**
   - Nom: (celui dans BD)
   - Prénom: (celui dans BD)
   - CIN: (celui dans BD)
   - Mot de passe: (même mot de passe utilisé lors de l'inscription)

2. **Cliquez sur "Se connecter"**

3. **Regardez la console** - vous verrez des logs commençant par `[DEBUG]`:
   ```
   [DEBUG LOGIN] Données du formulaire:
     firstName: "Jean"
     lastName: "Dupont"
     cin: "ABC123"
     password: "monMotDePasse123"
   [DEBUG LOGIN] Appel du service loginChef...
   [DEBUG] loginChef: Tentative de connexion
   [DEBUG] CIN saisi: "ABC123" | CIN trimé: "ABC123"
   [DEBUG] Réponse Supabase - error: null
   [DEBUG] Réponse Supabase - chef données: {id: "...", cin: "ABC123", first_name: "Jean", last_name: "Dupont", password_hash: "[HASH EXISTS]"}
   [DEBUG] Chef trouvé: Jean Dupont
   [DEBUG] Hash saisi: a1b2c3d4e5...
   [DEBUG] Hash BD: a1b2c3d4e5...
   [DEBUG] Les hashes correspondent? true
   ```

---

## Étape 4: Analyser les erreurs

### Si le log dit "Chef non trouvé":
- Le CIN n'existe pas en BD
- Vérifiez l'orthographe exacte dans Supabase

### Si le log dit "Mot de passe incorrect":
- Le mot de passe saisi ne correspond pas au hash en BD
- **Cause possible**: Le mot de passe lors de l'inscription n'était pas celui qu'on utilise maintenant
- Créez un **nouveau compte** avec un mot de passe simple: `Test1234!`
- Utilisez ce même mot de passe pour la connexion

### Si le log dit "Le nom ou prénom ne correspond pas":
- Vérifiez les espaces ou la casse
- (Cette erreur devrait être corrigée maintenant)

### Si le log dit "Les hashes ne correspondent pas" mais le chef est trouvé:
- C'est le problème du mot de passe
- Les deux hashes sont différents
- Créez un nouveau compte et testez

---

## Étape 5: Reporter les résultats

Copiez-collez les logs de la console ici et dites:
1. Était-ce une connexion réussie?
2. Si erreur, à quelle ligne exacte?
3. Quels sont les détails du compte utilisé?

---

## Fichiers modifiés

✅ `client/lib/authService.ts` - Logs ajoutés à `loginChef()`
✅ `client/pages/Login.tsx` - Logs ajoutés à `handleLogin()` + correction case-insensitive pour nom/prénom
