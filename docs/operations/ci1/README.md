# CI-1 — Contrôles automatiques et préparation de livraison

Date de référence : 20 octobre 2026. Le workflow vérifie les changements et exécute la recette de préproduction isolée. Il ne modifie pas le schéma et ne doit jamais utiliser la production comme cible de test.

## Contrôle automatique sans secret

`.github/workflows/ci.yml` lance le job `Contrôles sans secrets` sur chaque changement de `main`, chaque demande de fusion et chaque lancement manuel. Il exécute dans cet ordre :

1. recherche de fichiers secrets et de signatures d'identifiants à haute confiance avec `npm run ci:secrets` ;
2. installation reproductible avec `npm ci` ;
3. types, lint strict et règles métier avec `npm run check` ;
4. liens, commandes et variables documentés avec `npm run docs:verify` ;
5. audit des dépendances de production avec `npm run audit:prod` ;
6. build Next.js avec trois valeurs publiques factices.

Les valeurs de build utilisent `https://ci.invalid` et une clé publique factice. Elles servent seulement à initialiser le client Supabase pendant le pré-rendu ; elles ne donnent accès à aucun service. Le scanner local complète les protections du futur hébergeur Git, mais ne remplace pas son analyse de secrets ni une rotation après exposition.

## Recette connectée de préproduction

Le job `Recette préproduction` ne s'exécute que lors d'un lancement manuel avec `run_connected=true`, après réussite du job local. L'environnement GitHub `preproduction` contient exclusivement les secrets de la cible isolée :

- `PREPROD_APP_URL` ;
- `PREPROD_SUPABASE_URL` ;
- `PREPROD_SUPABASE_ANON_KEY` ;
- `PREPROD_SUPABASE_SERVICE_ROLE_KEY` ;
- `PREPROD_DATABASE_URL` ;
- `PREPROD_DIRECT_URL` ;
- `PREPROD_CRON_SECRET` ;
- `PREPROD_OPS_HEALTH_SECRET` ;
- `PREPROD_EXPECTED_APP_HOST` ;
- `PREPROD_EXPECTED_SUPABASE_REF`.

Le job refuse d'abord toute cible qui ne correspond pas à la référence Supabase et à l'hôte attendus. Il exécute les 279 règles locales, la recette connectée A/B, puis monte une démonstration temporaire sur la cible vide avant les quatre parcours Chromium. Un nettoyage `always()` supprime ensuite le socle, les quatre sessions isolées, leurs utilisateurs, leur utilisateur Auth et leurs éventuels objets Storage. Une suppression est refusée si le graphe, le roster ou les objets ne sont pas strictement ceux de la fixture. Cinq fichiers de preuve sans secret sont conservés sept jours seulement lorsque la suite entière et le nettoyage réussissent. Les liens et e-mails réels restent désactivés.

La Preview Vercel est protégée par l'authentification de l'équipe et renvoie donc 401 à un navigateur d'automatisation non connecté. La recette fonctionnelle démarre le commit testé dans le runner et le relie au Supabase de préproduction. Le déploiement Vercel du même commit est vérifié séparément via son statut GitHub/Vercel ; aucun contournement public de la protection n'est créé.

## Déploiement et retour arrière de préproduction

La publication Git de `preproduction` crée une Preview sans écriture de schéma implicite. Avant de retenir un commit sain, vérifier le job sans secret, la recette connectée manuelle et le statut `Ready` de son déploiement Vercel. Conserver le SHA, l'identifiant du déploiement et la durée dans le rapport de validation.

Sur une Preview Hobby, `Instant Rollback` est indisponible. Ouvrir le déploiement sain de la branche, choisir `Redeploy`, vérifier que l'environnement sélectionné est `Preview` et que la branche est `preproduction`, puis attendre `Ready`. Pour revenir au commit courant, redéployer de la même manière son déploiement sain. Cette action reconstruit le même code avec les réglages de projet actuels ; elle ne réutilise pas un binaire immuable. Ne jamais choisir `Production`, `Promote` ou `Force Promote` pendant cette procédure.

Les évolutions de base exigent leur propre procédure testée sur une copie isolée. Un retour arrière d'application ne doit jamais effacer ou rétrograder la base. La production future devra réutiliser un artefact qualifié avec ses propres secrets et une procédure adaptée au plan d'hébergement retenu.

## Validation du 20 octobre 2026

- retour vers le commit sain `f6e19cc` : Preview `Ready` en 1 min 39 s ;
- rétablissement du commit courant `04a0a35` : Preview `Ready` en 2 min 11 s ;
- alias stable de `preproduction` réassigné au commit courant ;
- contrôle Supabase final conforme, avec zéro utilisateur Auth ;
- branche `main` et déploiement Production inchangés.

Maintenir la recette connectée après toute modification du montage ou du nettoyage. La restauration base + Storage reste couverte par DB-1 et OPS-03A.
