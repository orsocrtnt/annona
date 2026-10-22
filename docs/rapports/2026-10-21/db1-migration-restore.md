# DB-1 — Migration et restauration logique vérifiées

Date : 21 octobre 2026  
Cible : préproduction Supabase isolée  
Résultat : réussi

## Objectif

Fermer DB-1 en démontrant que l'histoire Prisma du dépôt peut reconstruire une base, qu'un jeu de données applicatif représentatif peut être restauré sans perte et que la répétition ne modifie ni le schéma public ni les données de démonstration déjà présentes.

## Méthode sûre

La répétition a créé deux schémas PostgreSQL temporaires dont les noms sont générés et validés par une expression stricte. Le script refuse les schémas `public`, `auth`, `storage`, tout nom inattendu et toute URL non PostgreSQL. Une variable de confirmation dédiée est également obligatoire.

Les deux migrations du dépôt ont été appliquées dans le premier schéma. Un graphe fictif a ensuite couvert société, utilisateurs et rôles, commande récurrente, commande et articles, étapes, livraison, position, suivi, tâche asynchrone, facture, support, messages, lectures et notifications. Les vingt tables applicatives ont été exportées en JSON canonique, puis restaurées dans un second schéma reconstruit par les mêmes migrations.

Le script a comparé les empreintes SHA-256 des vingt tables, vérifié la présence des deux migrations, RLS, les références RBAC et l'absence de drift. Un second `migrate deploy` a confirmé qu'aucune migration ne restait à appliquer. Les deux schémas temporaires ont ensuite été supprimés.

## Résultats

- 20 tables sur 20 restaurées à l'identique ;
- 2 migrations terminées dans la source et la restauration ;
- RLS active sur les 20 tables applicatives dans les deux schémas ;
- 6 rôles, 33 permissions et 109 liaisons restaurés ;
- zéro drift Prisma ;
- rejeu des migrations sans opération restante ;
- deux schémas temporaires supprimés ;
- empreinte du schéma public identique avant/après ;
- compteurs des données publiques et du bucket identiques avant/après ;
- durée totale observée : 38,7 secondes ;
- aucun secret enregistré dans les preuves.

Le contrôle final de la préproduction retrouve les vingt tables, les deux migrations, RLS, aucun droit direct public, le bucket privé conforme et les références RBAC exactes. Les seules données observées sont le modèle de démonstration permanent et trois sessions temporaires valides, soit quatre sociétés, trente-deux utilisateurs applicatifs et un utilisateur Auth.

## Périmètre et limite

Cette preuve valide la restauration logique des données PostgreSQL et la reproductibilité des migrations. Elle ne prétendait pas, à elle seule, valider une restauration complète du service Supabase ni la recopie des objets de preuve dans Storage. Ce scénario a ensuite été validé séparément par OPS-03A dans `docs/rapports/2026-10-21/ops03a-provider-restore.md`.

La cible historique et ses 51 anciennes démonstrations n'ont été ni migrées, ni baselinées, ni modifiées. Toute intervention sur cette cible demandera une sauvegarde et une autorisation distinctes.

## Commandes de preuve

- `npm run typecheck`
- `node --import tsx --test tests/db1-restore-safety.test.ts`
- `DB1_RESTORE_REHEARSAL=I_UNDERSTAND_TEMP_SCHEMAS_ONLY npm run db1:rehearse-preproduction`
- `dotenv -e .env.preproduction.local -- npm run ci:preprod-env`
- `dotenv -e .env.preproduction.local -- npm run db1:verify-preproduction`

Les résultats structurés sont enregistrés dans `outputs/db1/migration-restore-rehearsal.json` et `outputs/db1/preproduction-validation.json`.
