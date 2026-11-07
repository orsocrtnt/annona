# Documentation Annona

Cet index distingue la documentation courante des preuves datées. En cas de contradiction, le code et `TODO.md` priment ; corriger ensuite le document concerné.

## Produit

- [`../PRODUCT.md`](../PRODUCT.md) — résumé du produit (commande et livraison B2B pour boulangerie) ;
- [`cahier-des-charges/`](cahier-des-charges/TRI-BASE.md) — cahier des charges (PDF, exigences CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF) et tri de la base existante (`TRI-BASE.md`).

## Références courantes

- [`../README.md`](../README.md) — démarrage rapide et commandes essentielles ;
- [`../TODO.md`](../TODO.md) — source unique des priorités, statuts et blocages ;
- [`../AGENTS.md`](../AGENTS.md) — boucle de travail et règles de sécurité ;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture applicative et flux ;
- [`DATABASE.md`](DATABASE.md) — schéma, isolation et changements de base ;
- [`RBAC.md`](RBAC.md) — rôles, permissions et défenses serveur ;
- [`OPERATIONS.md`](OPERATIONS.md) — installation, variables, tests, dépannage et reprise ;
- [`CONVENTIONS.md`](CONVENTIONS.md) — conventions de code ;
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — direction visuelle et composants ;
- [`AUTH_EMAIL_SETUP.md`](AUTH_EMAIL_SETUP.md) — activation des invitations et récupérations ;
- [`MOBILE.md`](MOBILE.md) — applications iOS et Android (Capacitor) : architecture, ponts natifs, variables, commandes et étapes de publication ;
- [`FACTURX.md`](FACTURX.md) — factures de livraison au format Factur-X : profil, contrôles, limites et point d'extension plateforme agréée ;
- [`legal/README.md`](legal/README.md) — dossier préparatoire France pour la revue juridique, responsabilités, fournisseurs, inconnues et porte avant données réelles ;
- [`operations/map-providers.md`](operations/map-providers.md) — fournisseurs cartographiques ;
- [`operations/support1/README.md`](operations/support1/README.md) — exploitation du support.
- [`operations/ops03b/README.md`](operations/ops03b/README.md) — santé du service, alertes et réaction aux incidents.
- [`operations/ops03a/README.md`](operations/ops03a/README.md) — sauvegarde complète et exercice de restauration isolée.
- [`operations/ci1/README.md`](operations/ci1/README.md) — contrôles automatiques, recette connectée protégée et préparation de livraison.
- [`operations/env1/README.md`](operations/env1/README.md) — séparation des cibles et matrice de configuration sans secrets.
- [`operations/env1/COSTS.md`](operations/env1/COSTS.md) — estimation fournisseur avant toute dépense.
- [`operations/db1/README.md`](operations/db1/README.md) — diff de schéma, brouillons de baseline et stratégie de migration.
- [`operations/data02/RETENTION_POLICY_DRAFT.md`](operations/data02/RETENTION_POLICY_DRAFT.md) — proposition de conservation et suppression à valider juridiquement.
- [`operations/map3/REVIEW.md`](operations/map3/REVIEW.md) — support de validation des cartes noir/blanc.
- [`operations/bill01b/README.md`](operations/bill01b/README.md) — export comptable versionné des prestations, colonnes, filtres, rapprochement et limites historiques.
- [`operations/email/README.md`](operations/email/README.md) — modes désactivé/recette/réel, transport métier et protocole d'envoi contrôlé.

## Preuves et archives

`docs/rapports/YYYY-MM-DD/` contient les résultats obtenus à une date précise. `docs/operations/` contient les procédures propres à une fonctionnalité. Une réussite ancienne ne garantit pas qu'une régression ultérieure est absente ; utiliser les commandes de vérification courantes avant de conclure.

Les documents de rapport ne doivent contenir aucun secret, cookie, e-mail de fixture ou chaîne de connexion. Les sorties locales se trouvent sous `outputs/` (non versionné) et doivent respecter la même règle.

## Contexte des agents

Tous les agents lisent et modifient le contexte du dépôt uniquement, sur la branche `base`. Aucun push sans demande explicite du propriétaire. Voir `../AGENTS.md` et `../.cursor/rules/contexte-markdown.mdc`.

Les documents juridiques présents sous `legal/` ont été rédigés pour l'ancien produit (coursiers) : ce sont des audits ou des propositions, pas des contrats signés, et ils restent à revoir pour la boulangerie.
