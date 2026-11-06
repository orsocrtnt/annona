# ENV-2 — Projet Supabase de développement

Le développement local vise un projet Supabase dédié, `annona-dev` (`mhzdmoytxmzudhkivixh`, Paris), distinct de la préproduction. Les anciens projets (`wlomrzil…`, `annona-restore-rehearsal`) sont en pause et refusés par le garde-fou.

## Garde-fou

```bash
npm run env2:verify-dev
```

Le contrôle lit `.env.local` et ne renvoie que des codes d'erreur, jamais de valeur. Il exige :

- une application locale (`localhost` ou `127.0.0.1`) ;
- `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` et `DIRECT_URL` sur le projet de développement, et aucun projet interdit ;
- des identifiants présents dans les deux adresses de base ;
- des clés Supabase publique et service distinctes ;
- une clé Stripe de test si `STRIPE_SECRET_KEY` est renseignée.

Lancer ce contrôle avant toute commande qui écrit dans la base locale. Test : `tests/env2-dev-isolation.test.ts`.

## Remise à niveau d'un projet neuf

1. Vérifier l'isolement : `npm run env2:verify-dev`.
2. Installer le déclencheur Supabase `ensure_rls` (fonction `public.rls_auto_enable`), présent en préproduction mais absent d'un projet créé hors tableau de bord. Sans lui, la migration `20261022132000_revoke_rls_trigger_execution` échoue. Recopier sa définition depuis la préproduction (`pg_get_functiondef`), puis créer l'event trigger `ensure_rls` sur `ddl_command_end` pour `CREATE TABLE`, `CREATE TABLE AS` et `SELECT INTO`.
3. Appliquer les migrations avec `DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy`, puis contrôler l'absence d'écart avec `prisma migrate diff`.
4. Écrire les données de référence et de démonstration : `npm run db:seed`, puis `npm run db:seed-demo`.
5. Remplir la réserve d'espaces de démonstration avec `npx dotenv -e .env.local -- npx tsx scripts/demo2/prepare-pool.ts`. Le script `npm run demo2:prepare` vise la préproduction.
6. Contrôler : `npm run test:demo1`, puis connexion avec le compte de démonstration et ouverture des pages connectées.

La surveillance OPS-03B ne s'exécute pas sur ce projet : aucune migration ne la planifie et sa fonction s'arrête (`OPS03B_MONITOR_NOT_CONFIGURED`) tant que le coffre Supabase est vide.

## État au 2026-10-27

19 migrations appliquées, 39 tables, sécurité par ligne sur toutes, aucune policy, aucun droit pour `anon` ni `authenticated`, comme en préproduction. Aucune tâche planifiée, coffre vide. Réserve de démonstration : 3 espaces prêts. Serveur local sur le port 3108 : connexion de démonstration, puis `/dashboard`, `/dispatch`, `/users`, `/support`, `/settings` et `/settings/subscription` en 200, sans erreur JavaScript.
