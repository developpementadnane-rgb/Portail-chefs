# Edge Function: query-database

Fonction générique de requête/mutation sur la base de données,
déployée séparément du reste de l'app (Netlify Functions ne gère que
`/api/*` — voir `netlify/functions/api.ts`).

## Déploiement

```bash
npx supabase functions deploy query-database --project-ref <votre-ref-projet>
```

Nécessite la [Supabase CLI](https://supabase.com/docs/guides/cli)
installée et authentifiée (`npx supabase login`).

## Variables d'environnement requises

Configurez ces secrets côté Supabase (pas dans `.env` du dépôt) :

```bash
npx supabase secrets set QUERY_DATABASE_SECRET=<un-secret-long-aleatoire>
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont automatiquement
disponibles dans l'environnement d'exécution des Edge Functions — pas
besoin de les définir manuellement.

## Garde-fous de sécurité ajoutés

Le code fourni initialement n'avait aucune restriction sur les tables
ou actions accessibles, alors qu'il utilise la clé service role
(contourne toute RLS). N'importe quel token valide aurait pu lire ou
**supprimer** n'importe quelle ligne de n'importe quelle table,
y compris les données des membres et des chefs. Trois garde-fous ont
été ajoutés :

1. **Liste blanche de tables** (`ALLOWED_TABLES` dans le code) — seules
   `sessions`, `ideas`, `daily_reports`, `attendance_sync_log` sont
   accessibles. `member_profiles` et `user_chefs` sont volontairement
   exclues : elles ont déjà des chemins d'accès dédiés et revus
   (`client/lib/offline/membersCache.ts`, les routes serveur
   `server/routes/*`).
2. **Secret supplémentaire pour les mutations** — `insert`/`update`/
   `delete` exigent un en-tête `X-Function-Secret` correspondant à
   `QUERY_DATABASE_SECRET`, en plus du JWT. Un simple utilisateur
   connecté ne peut donc pas modifier ou supprimer des données via
   cette fonction générique.
3. **Filtre obligatoire pour update/delete** — refuse une requête
   `update` ou `delete` sans filtre, pour éviter qu'une erreur ou un
   filtre vide ne touche une table entière.

Pour autoriser une table supplémentaire, ajoutez-la explicitement à
`ALLOWED_TABLES` dans `supabase/functions/query-database/index.ts` —
ce n'est jamais un ajout anodin, réfléchissez à qui doit pouvoir lire
ou modifier cette table avant de l'ajouter.

## Bug corrigé

Le code original appelait `req.json()` deux fois dans les branches
`insert`/`update` (une fois en haut de la fonction, une fois dans le
switch) — un corps de requête ne peut être lu qu'une seule fois,
donc tout insert/update aurait levé une exception. Corrigé en
parsant le body une seule fois au début.

## Exemple d'appel

```javascript
// Lecture (JWT seul suffit)
const res = await fetch('https://<projet>.supabase.co/functions/v1/query-database', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAccessToken}`,
  },
  body: JSON.stringify({
    table: 'sessions',
    action: 'select',
    columns: 'id,title,date_time',
    order: 'date_time.desc',
    limit: 10,
  }),
});

// Mutation (JWT + secret de fonction requis)
const res2 = await fetch('https://<projet>.supabase.co/functions/v1/query-database', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAccessToken}`,
    'X-Function-Secret': '<QUERY_DATABASE_SECRET>',
  },
  body: JSON.stringify({
    table: 'ideas',
    action: 'update',
    data: { status: 'reviewed' },
    filters: 'id.eq.123',
  }),
});
```
