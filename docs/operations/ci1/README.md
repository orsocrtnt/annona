# CI-1 — Contrôles automatiques et préparation de livraison

Date de référence : 17 octobre 2026. Le workflow vérifie les changements et prépare la future recette de préproduction. Il ne déploie rien, ne modifie pas le schéma et ne doit jamais utiliser la production comme cible de test.

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

Le job `Recette préproduction` ne s'exécute que lors d'un lancement manuel avec `run_connected=true`, après réussite du job local. Créer un environnement protégé nommé `preproduction`, exiger l'approbation d'un responsable et y définir exclusivement les secrets de la cible isolée :

- `PREPROD_APP_URL` ;
- `PREPROD_SUPABASE_URL` ;
- `PREPROD_SUPABASE_ANON_KEY` ;
- `PREPROD_SUPABASE_SERVICE_ROLE_KEY` ;
- `PREPROD_DATABASE_URL` ;
- `PREPROD_DIRECT_URL` ;
- `PREPROD_CRON_SECRET`.

Le job installe Chromium puis lance `npm run test:v1`. Cette suite crée deux entreprises préfixées `test2-`, vérifie les trois rôles et nettoie ses fixtures. Les trois fichiers de preuve sans secret sont conservés sept jours seulement lorsque la suite entière réussit. Les liens e-mail réels restent désactivés.

## Mise en service future

Après ENV-1 et DB-1, compléter le workflow avec une livraison vers la préproduction sans écriture de schéma implicite. Vérifier le diagnostic profond, exécuter TEST-2, conserver l'artefact immuable validé puis demander l'accord de publication. La production doit réutiliser exactement cet artefact, avec ses propres secrets.

Le retour arrière applicatif doit redéployer le dernier artefact sain. Les évolutions de base exigent leur propre procédure testée sur une copie isolée ; un retour arrière d'application ne doit jamais supposer que la base peut être effacée ou rétrogradée. Chronométrer une publication et son retour arrière avant de cocher CI-1.

## Blocages actuels

- le dépôt `origin` existe, mais le workflow local non publié n'a pas encore été exécuté par GitHub ;
- l'environnement de préproduction et ses secrets dépendent d'ENV-1 ;
- la baseline et la stratégie de retour arrière de base dépendent de DB-1 ;
- aucun déploiement ni retour arrière réel n'a été tenté.
