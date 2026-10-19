# DB-1 — Baseline et évolutions de base

Date de référence : 19 octobre 2026. La première phase d'inventaire reste en lecture seule. La migration décrite ci-dessous a ensuite été autorisée et exécutée exclusivement sur la préproduction vide.

## Contrôle reproductible

`npm run audit:db1` compare la cible définie dans `.env.local` à `prisma/schema.prisma`, inventorie la protection publique et calcule une empreinte du catalogue avant/après. La commande génère :

- `outputs/db1/inventory.json` : preuve structurée sans URL ni secret ;
- `outputs/db1/prisma-baseline-draft.sql` : création des objets représentés par Prisma ;
- `outputs/db1/security-baseline-draft.sql` : activation RLS et retrait des droits directs sur les vingt tables observées.

Les deux fichiers SQL portent un avertissement et restent hors de `prisma/migrations`. Ils ne doivent être appliqués à aucune base.

## État constaté

La cible possède vingt tables publiques pour vingt modèles Prisma et seize enums. Les vingt tables ont RLS active, aucune politique publique n'est définie et aucun droit de table n'est accordé à `anon`, `authenticated` ou `PUBLIC`. Cet état ferme l'accès direct ; l'application serveur privilégiée doit toujours appliquer l'isolation d'entreprise.

Il n'existe ni répertoire `prisma/migrations`, ni table `_prisma_migrations`. La cible est donc antérieure à une histoire Prisma Migrate reconnue.

Le premier diff contenait onze instructions : cinq suppressions puis cinq recréations de clés étrangères, et le retrait du défaut de `operation_jobs.updated_at`. Le catalogue utilise `NO ACTION` lors de la mise à jour de ces cinq relations et `CURRENT_TIMESTAMP` pour ce défaut. `schema.prisma` a été aligné sur ces propriétés existantes ; le diff est désormais vide. L'empreinte du catalogue avant/après est identique, preuve qu'aucune écriture distante n'a été faite.

## Construire la baseline sur une cible isolée

1. Terminé : identifier la préproduction vide `tutelliv-preproduction`.
2. Terminé : régénérer et comparer le brouillon Prisma avec le schéma courant.
3. Terminé : ajouter le complément sécurité après la création des tables.
4. Terminé pour Storage : créer le bucket privé `delivery-pods`, limité à 5 Mio aux JPEG/PNG. Les réglages Auth dépendant de l'URL Vercel restent à faire.
5. Terminé : placer la version revue dans `prisma/migrations/20261019000000_initial/migration.sql`.
6. Terminé : appliquer la migration initiale à la préproduction vide.
7. Terminé pour la baseline : vérifier les vingt tables, le registre Prisma, RLS, les retraits de droits, zéro utilisateur Auth, Storage privé et zéro drift. TEST-2 reste à exécuter après remplacement des identifiants et déploiement Preview.
8. Sur une base existante identique, marquer `0_init` comme déjà appliquée seulement après sauvegarde, diff vide et autorisation explicite.

Prisma décrit ce flux pour une base existante : la migration initiale recrée l'état complet sur une base vide, tandis qu'une cible existante identique la marque comme appliquée afin de ne pas recréer ses tables. Le projet utilise Prisma 5.22 ; conserver les commandes compatibles avec cette version : [Prisma — Baselining a database](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).

## Stratégie de retour arrière

- préférer les migrations additives et le schéma expand/contract ;
- garder l'ancienne application compatible pendant la période de retour ;
- revenir à l'artefact applicatif précédent seulement si la base reste compatible ;
- corriger en avant une évolution déjà partagée quand cela préserve les données ;
- pour suppression ou transformation irréversible, arrêter les écritures et restaurer la sauvegarde validée par OPS-03A ;
- ne jamais utiliser `db push --force-reset`, supprimer une table ou effacer une base comme retour arrière.

Une migration n'est considérée réversible que lorsque son scénario de panne et sa reprise ont été exécutés sur la préproduction isolée avec mesures et données fictives.

## Blocages actuels

- mot de passe PostgreSQL et clé serveur à remplacer avant déploiement ;
- URL Auth et recette TEST-2 à vérifier sur la Preview ;
- migration additive et reprise correspondante à exercer ;
- sauvegarde/restauration complète OPS-03A non exercée ;
- baseline non marquée sur la cible existante, qui reste volontairement inchangée.
