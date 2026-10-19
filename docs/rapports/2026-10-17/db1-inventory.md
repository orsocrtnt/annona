# DB-1 — Inventaire et diff de schéma

Date : 17 octobre 2026. Avancement partiel de DB-1, exécuté en lecture seule sur la cible de test autorisée.

## Défaut constaté et correction locale

Le premier diff Prisma a produit onze instructions. Cinq relations récentes auraient été supprimées puis recréées, car la base utilise `NO ACTION` à la mise à jour alors que Prisma supposait son défaut `CASCADE`. Le champ `operation_jobs.updated_at` possède aussi `CURRENT_TIMESTAMP` en base, absent de la définition Prisma.

La définition locale a été alignée sur ces propriétés déjà déployées : `onUpdate: NoAction` sur les cinq relations, `onDelete: NoAction` sur l'auteur de message, et `@default(now())` sur le timestamp de tâche. Le client Prisma a été régénéré. Le nouveau diff cible → schéma contient zéro instruction. Aucune contrainte ou ligne distante n'a été modifiée.

## Inventaire

- vingt modèles Prisma, seize enums et vingt tables publiques ;
- RLS active sur les vingt tables ;
- zéro politique et zéro droit direct `anon`, `authenticated` ou `PUBLIC` ;
- aucune table `_prisma_migrations` et aucun dossier de migrations dans le dépôt ;
- empreinte de catalogue identique avant et après l'audit ;
- zéro mutation.

Le brouillon Prisma contient 119 instructions. Un second brouillon reproduit l'activation RLS et les retraits de droits pour les vingt tables. Ils sont séparés pour rendre visible ce que Prisma ne génère pas, mais ne sont pas applicables directement. Auth, Storage, bucket privé et configuration fournisseur restent à ajouter et vérifier.

## Validation

Le schéma Prisma est valide et le client a été régénéré. Types, lint strict, 235/235 tests et le build Next.js de 100 pages passent. Les deux scripts d'inventaire passent ESLint ; 38 documents sont cohérents, le scanner ne trouve aucun secret dans 802 fichiers et `git diff --check` réussit. Le second audit confirme encore zéro instruction en attente et une empreinte distante inchangée.

## Conclusion limitée

Le schéma Prisma représente maintenant la cible de test sans drift détecté. Cela ne constitue pas une baseline déployable : il faut une préproduction vide, la revue des deux brouillons, l'ajout Auth/Storage, un essai complet puis le marquage contrôlé de la cible existante. La restauration reste couverte par OPS-03A.

Procédure : `docs/operations/db1/README.md`. Preuves : `outputs/db1/inventory.json`, `outputs/db1/prisma-baseline-draft.sql`, `outputs/db1/security-baseline-draft.sql`.
