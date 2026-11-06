# DB-1 — Baseline et évolutions de base

Date de référence : 21 octobre 2026. La première phase d'inventaire reste en lecture seule. Les migrations et la répétition de restauration décrites ci-dessous ont ensuite été exécutées exclusivement sur la préproduction isolée.

## Contrôle reproductible

`npm run audit:db1` compare la cible définie dans `.env.local` à `prisma/schema.prisma`, inventorie la protection publique et calcule une empreinte du catalogue avant/après. La commande génère :

- `outputs/db1/inventory.json` : preuve structurée sans URL ni secret ;
- `outputs/db1/prisma-baseline-draft.sql` : création des objets représentés par Prisma ;
- `outputs/db1/security-baseline-draft.sql` : activation RLS et retrait des droits directs sur les vingt tables observées.

Les deux fichiers SQL portent un avertissement et restent hors de `prisma/migrations`. Ils ne doivent être appliqués à aucune base.

## État constaté

La cible possède vingt tables publiques pour vingt modèles Prisma et seize enums. Les vingt tables ont RLS active, aucune politique publique n'est définie et aucun droit de table n'est accordé à `anon`, `authenticated` ou `PUBLIC`. Cet état ferme l'accès direct ; l'application serveur privilégiée doit toujours appliquer l'isolation d'entreprise.

L'inventaire initial de la cible historique n'avait trouvé ni répertoire `prisma/migrations`, ni table `_prisma_migrations`. La préproduction possède désormais trois migrations versionnées : baseline initiale, références RBAC et noyau SaaS SAAS-01A.

Le premier diff contenait onze instructions : cinq suppressions puis cinq recréations de clés étrangères, et le retrait du défaut de `operation_jobs.updated_at`. Le catalogue utilise `NO ACTION` lors de la mise à jour de ces cinq relations et `CURRENT_TIMESTAMP` pour ce défaut. `schema.prisma` a été aligné sur ces propriétés existantes ; le diff est désormais vide. L'empreinte du catalogue avant/après est identique, preuve qu'aucune écriture distante n'a été faite.

## Construire la baseline sur une cible isolée

1. Terminé : identifier la préproduction vide `annona-preproduction`.
2. Terminé : régénérer et comparer le brouillon Prisma avec le schéma courant.
3. Terminé : ajouter le complément sécurité après la création des tables.
4. Terminé pour Storage : créer le bucket privé `delivery-pods`, limité à 5 Mio aux JPEG/PNG. Les réglages Auth dépendant de l'URL Vercel restent à faire.
5. Terminé : placer la version revue dans `prisma/migrations/20261019000000_initial/migration.sql`.
6. Terminé : appliquer la migration initiale à la préproduction vide.
7. Terminé pour la baseline : vérifier les vingt tables, le registre Prisma, RLS, les retraits de droits, Storage privé et zéro drift. TEST-2 passe sur la Preview après rotation des identifiants.
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

## Répétition migration et restauration

La commande suivante est réservée à la préproduction et exige une confirmation explicite dans son environnement d'exécution :

`DB1_RESTORE_REHEARSAL=I_UNDERSTAND_TEMP_SCHEMAS_ONLY npm run db1:rehearse-preproduction`

Elle applique les migrations dans deux schémas PostgreSQL temporaires strictement nommés, crée un graphe fictif représentatif, exporte les 29 tables applicatives, restaure cet export dans le second schéma et compare une empreinte SHA-256 pour chaque table. Elle rejoue enfin `migrate deploy`, vérifie l'absence de migration en attente et supprime les deux schémas temporaires.

Les garde-fous refusent `public`, `auth`, `storage`, tout autre nom de schéma et toute URL non PostgreSQL. Une empreinte du schéma public ainsi que les compteurs applicatifs et Storage sont comparés avant/après. La répétition finale du 21 octobre a restauré les 29 tables à l'identique, retrouvé les trois migrations, RLS sur les 29 tables, les références 6 rôles / 33 permissions / 109 liaisons et zéro drift. Les schémas temporaires ont été supprimés ; le schéma public, ses données et le bucket sont restés inchangés. Le 22 octobre, la troisième migration a ensuite été appliquée à la préproduction isolée et le même contrôle y est passé.

Le contrôle `npm run db1:verify-preproduction` accepte une cible vide ou la démo permanente accompagnée uniquement de sessions temporaires portant les marqueurs de rétention et le roster synthétique exacts. Il refuse toute autre société ou tout autre utilisateur. Le contrôle final a retrouvé le modèle permanent, trois sessions temporaires reconnues, un seul utilisateur Auth et aucune anomalie de sécurité.

## Limites et suite

- la répétition DB-1 valide la migration et la restauration logique des données PostgreSQL ; elle ne copie volontairement aucun objet Storage ;
- la restauration complète du service, des preuves Storage et les procédures fournisseur restent dans OPS-03A ;
- la cible historique et ses 51 anciennes démonstrations restent volontairement inchangées ; son éventuelle baselining attend une sauvegarde et une autorisation explicite ;
- les migrations destructives futures devront chacune avoir leur propre scénario expand/contract, sauvegarde et répétition sur préproduction.
