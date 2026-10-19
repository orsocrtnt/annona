# ENV-1 — Séparer développement, préproduction et production

Date de référence : 17 octobre 2026. Cette procédure prépare les cibles sans les créer. Toute nouvelle ressource fournisseur peut avoir un coût et doit être confirmée avant création.

## État observé sans secret

`npm run audit:env1` lit seulement la forme de la configuration et écrit `outputs/env1/inventory.json`. Il ne journalise aucune URL, clé, chaîne de connexion, identifiant de projet ou nom de dépôt.

La cible disponible est la base de test actuellement autorisée pour des données fictives. L'application s'ouvre localement ; Supabase, la connexion PostgreSQL poolée et l'accès direct sont configurés. Le dépôt `origin` utilise GitHub et le dossier est relié à un projet Vercel. `.env.local` est ignoré par Git. Il n'existe cependant qu'un seul jeu local de variables : aucune préproduction ou production distincte n'a été identifiée.

Le diagnostic profond reçoit actuellement un secret temporaire au lancement du serveur et ne le conserve pas dans `.env.local`. Les liens Auth, l'expéditeur Resend et le webhook d'incident restent désactivés.

## Matrice cible

### Développement

- conserver la cible actuelle uniquement pour données fictives et tests connectés ;
- utiliser `.env.local`, jamais suivi par Git ;
- autoriser les fixtures préfixées et leur nettoyage ciblé ;
- ne pas activer les envois vers des destinataires réels.

### Préproduction

- créer un projet Supabase séparé, sans copie de données personnelles ;
- associer une Preview Vercel stable ou un environnement personnalisé selon le plan choisi ;
- configurer l'environnement GitHub protégé `preproduction` attendu par CI-1 ;
- générer des valeurs distinctes pour Supabase, PostgreSQL, cron, santé et webhook ;
- conserver `AUTH_EMAIL_LINKS_ENABLED=false` jusqu'à la recette EMAIL ;
- appliquer uniquement les migrations versionnées de DB-1, puis lancer TEST-2 ;
- bloquer toute URL, clé ou connexion pointant vers la production.

### Production

- créer un troisième projet Supabase et l'environnement Vercel Production seulement après les portes de lancement ;
- générer tous les secrets indépendamment de la préproduction ;
- limiter les accès humains et machine au besoin réel ;
- ne jamais y lancer TEST-2, seed, reset de démonstration ou commande de schéma interactive ;
- publier exactement l'artefact validé en préproduction, puis activer santé, alertes et sauvegardes vérifiées.

La documentation Supabase recommande des projets staging et production séparés pour son flux multi-environnement. Vercel fournit Local, Preview et Production, avec variables propres à chaque environnement ; les environnements personnalisés et protections dépendent du plan. Vérifier les coûts et capacités du compte avant de choisir : [Supabase — Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments), [Vercel — Environments](https://vercel.com/docs/deployments/environments), [Vercel — Environment Variables](https://vercel.com/docs/environment-variables).

## Variables qui doivent être distinctes

Chaque cible reçoit ses propres valeurs pour :

- `NEXT_PUBLIC_APP_URL` ;
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` ;
- `DATABASE_URL` et `DIRECT_URL` ;
- `CRON_SECRET` et `OPS_HEALTH_SECRET` ;
- `OPS_ALERT_WEBHOOK_URL` et `OPS_ALERT_WEBHOOK_TOKEN` lorsqu'ils sont activés ;
- `RESEND_API_KEY` et l'expéditeur lorsque les e-mails sont qualifiés.

Les variables cartographiques publiques peuvent partager un fournisseur seulement si quotas, domaine autorisé et coût sont adaptés. Une valeur `NEXT_PUBLIC_*` changeant entre cibles exige un nouveau build.

## Contrôle avant recette connectée

1. Nommer explicitement la cible et son propriétaire.
2. Confirmer dans Supabase qu'elle ne contient aucune donnée réelle.
3. Comparer les empreintes des hôtes et clés entre cibles, jamais leurs valeurs dans un rapport.
4. Vérifier le bucket privé, RLS et les droits selon SEC-06.
5. Vérifier que les secrets GitHub `PREPROD_*` pointent tous vers la même préproduction.
6. Lancer la santé profonde, puis `npm run test:v1`.
7. Confirmer zéro fixture résiduelle et absence d'e-mail réel.
8. Refuser la recette si une ressource de production est détectée.

## Limite actuelle

L'inventaire local ne peut ni lire les réglages des comptes fournisseurs, ni comparer des cibles qui n'existent pas, ni accepter un coût. ENV-1 reste ouverte jusqu'à la création et la recette d'une préproduction réellement isolée.
