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

La cible contenait zéro table publique avant l'application. Prisma Migrate a appliqué exactement une migration sans erreur.

## Validation connectée

`npm run db1:verify-preproduction`, chargé avec la configuration isolée, confirme :

- vingt tables métier et le registre Prisma ;
- RLS active sur les vingt-et-une tables publiques ;
- zéro politique publique et zéro droit direct pour les rôles navigateur ;
- une migration terminée et zéro drift avec `schema.prisma` ;
- zéro utilisateur Supabase Auth ;
- lecture anonyme de `companies` refusée ;
- bucket `delivery-pods` privé, limité à 5 Mio et aux JPEG/PNG.

Types, lint strict et 279 tests sur 279 réussissent après l'ajout de la migration et du vérificateur. Preuve nettoyée : `outputs/db1/preproduction-validation.json`.

## Limites restantes

Le mot de passe PostgreSQL et la clé serveur aperçus dans une vue technique sont considérés compromis et seront remplacés avant toute publication. Le formulaire Vercel a été fermé sans enregistrement. DB-1 reste ouverte jusqu'à la nouvelle vérification, TEST-2, l'essai d'une migration additive et de sa reprise, puis le traitement séparé de la cible historique après sauvegarde et autorisation.
