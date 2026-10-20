# DB-1 — Baseline sur la préproduction isolée

Date : 19 octobre 2026.

## Cible et isolation

Le projet Supabase gratuit `tutelliv-preproduction` a été créé à Paris. Il est distinct de la cible historique et ne contient aucune copie des 51 démonstrations. La garde d'environnement refuse explicitement la référence historique, les connexions incohérentes, les secrets partagés, les e-mails réels et le nettoyage automatique.

Les identifiants sont conservés uniquement dans `.env.preproduction.local`, ignoré par Git et limité au compte local. Aucune valeur sensible ne figure dans ce rapport ou dans la preuve JSON.

## Migration appliquée

La migration `20261019000000_initial` a été régénérée depuis `prisma/schema.prisma`, comparée au brouillon d'inventaire puis complétée avec :

- activation RLS sur les vingt tables métier et `_prisma_migrations` ;
- retrait des droits de table accordés à `PUBLIC`, `anon` et `authenticated` ;
- création du bucket privé `delivery-pods` ;
- limite de 5 Mio et types JPEG/PNG pour les preuves de livraison.

La cible contenait zéro table publique avant l'application. Prisma Migrate a appliqué la baseline puis la migration additive `20261019010000_rbac_reference_data`. Un second `prisma migrate deploy` confirme qu'aucune migration n'est en attente.

## Validation connectée

`npm run db1:verify-preproduction`, chargé avec la configuration isolée, confirme :

- vingt tables métier et le registre Prisma ;
- RLS active sur les vingt-et-une tables publiques ;
- zéro politique publique et zéro droit direct pour les rôles navigateur ;
- deux migrations terminées et zéro drift avec `schema.prisma` ;
- six rôles système, trente-trois permissions et cent neuf liaisons rôle-permission identiques aux références versionnées ;
- zéro utilisateur Supabase Auth ;
- lecture anonyme de `companies` refusée ;
- bucket `delivery-pods` privé, limité à 5 Mio et aux JPEG/PNG.

Types, lint strict et 279 tests sur 279 réussissent après l'ajout de la migration et du vérificateur. Preuve nettoyée : `outputs/db1/preproduction-validation.json`.

## État au 20 octobre 2026

Le mot de passe PostgreSQL et la clé serveur vus pendant la préparation ont été remplacés, puis l'ancienne clé serveur révoquée. Les nouvelles valeurs restent uniquement dans les magasins de secrets locaux, GitHub et Vercel préproduction. TEST-2 passe sur la cible isolée avec création puis suppression prouvée de toutes ses fixtures. DB-1 reste ouverte pour l'essai de restauration complète base + Storage et le traitement séparé de la cible historique après sauvegarde et autorisation.
