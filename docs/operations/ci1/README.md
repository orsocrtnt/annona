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

## Mise en service future

Après ENV-1 et DB-1, compléter le workflow avec une livraison vers la préproduction sans écriture de schéma implicite. Vérifier le diagnostic profond, exécuter TEST-2, conserver l'artefact immuable validé puis demander l'accord de publication. La production doit réutiliser exactement cet artefact, avec ses propres secrets.

Le retour arrière applicatif doit redéployer le dernier artefact sain. Les évolutions de base exigent leur propre procédure testée sur une copie isolée ; un retour arrière d'application ne doit jamais supposer que la base peut être effacée ou rétrogradée. Chronométrer une publication et son retour arrière avant de cocher CI-1.

## Travail restant

- maintenir l'essai distant connecté après toute modification du montage ou du nettoyage ;
- tester le redéploiement d'un artefact Vercel sain sur la cible isolée ;
- tester la restauration base + Storage avant de fixer les objectifs de reprise ;
- conserver `main` et la production hors de ces essais.
