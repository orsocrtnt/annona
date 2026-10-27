# Documentation TutelLiv

Cet index distingue la documentation courante des preuves datées. En cas de contradiction, le code et `TODO.md` priment ; corriger ensuite le document concerné.

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
- [`DECISIONS_PRODUIT_COMMERCIALES.md`](DECISIONS_PRODUIT_COMMERCIALES.md) — segment, exclusions, offres, pilotes et commissions confirmés ;
- [`SAAS_OFFERS_ARCHITECTURE.md`](SAAS_OFFERS_ARCHITECTURE.md) — architecture préparatoire des offres, quotas, droits et commissions ;
- [`legal/README.md`](legal/README.md) — dossier préparatoire France pour la revue juridique, responsabilités, fournisseurs, inconnues et porte avant données réelles ;
- [`operations/map-providers.md`](operations/map-providers.md) — fournisseurs cartographiques ;
- [`operations/test2/README.md`](operations/test2/README.md) — recette reproductible ;
- [`operations/support1/README.md`](operations/support1/README.md) — exploitation du support.
- [`operations/demo1/README.md`](operations/demo1/README.md) — sessions de démonstration isolées.
- [`operations/ops03b/README.md`](operations/ops03b/README.md) — santé du service, alertes et réaction aux incidents.
- [`operations/ops03a/README.md`](operations/ops03a/README.md) — sauvegarde complète et exercice de restauration isolée.
- [`operations/ci1/README.md`](operations/ci1/README.md) — contrôles automatiques, recette connectée protégée et préparation de livraison.
- [`operations/env1/README.md`](operations/env1/README.md) — séparation des cibles et matrice de configuration sans secrets.
- [`operations/env1/COSTS.md`](operations/env1/COSTS.md) — estimation fournisseur avant toute dépense.
- [`operations/db1/README.md`](operations/db1/README.md) — diff de schéma, brouillons de baseline et stratégie de migration.
- [`operations/mob01c/README.md`](operations/mob01c/README.md) — protocole de recette sur iPhone et Android physiques.
- [`operations/data02/RETENTION_POLICY_DRAFT.md`](operations/data02/RETENTION_POLICY_DRAFT.md) — proposition de conservation et suppression à valider juridiquement.
- [`operations/map3/REVIEW.md`](operations/map3/REVIEW.md) — support de validation des cartes noir/blanc.
- [`operations/bill01b/README.md`](operations/bill01b/README.md) — export comptable versionné des prestations, colonnes, filtres, rapprochement et limites historiques.
- [`operations/email/README.md`](operations/email/README.md) — modes désactivé/recette/réel, transport métier et protocole d'envoi contrôlé.
- [`operations/pilot1/README.md`](operations/pilot1/README.md) — portes, déroulement, mesures, incidents et sortie des trois pilotes accompagnés.
- [`operations/saas01b/README.md`](operations/saas01b/README.md) — journal de facturation sandbox, gardes Stripe test et recette locale sans compte.

## Produit et recette

- [`CADRAGE_CLIENT.md`](CADRAGE_CLIENT.md) — problème initial observé ;
- [`RECETTE_V1.md`](RECETTE_V1.md) — scénarios fonctionnels de la V1 ;
- [`VISION_PRODUIT_COMMERCIALE.md`](VISION_PRODUIT_COMMERCIALE.md) — vision finale, fonctions confirmées et hypothèses ;
- [`FUTURE_MODULES.md`](FUTURE_MODULES.md) — idées non engagées, subordonnées à la TODO.

## Preuves et archives

`docs/rapports/YYYY-MM-DD/` contient les résultats obtenus à une date précise. `docs/operations/` contient les procédures propres à une fonctionnalité. Une réussite ancienne ne garantit pas qu'une régression ultérieure est absente ; utiliser les commandes de vérification courantes avant de conclure.

Les documents de rapport ne doivent contenir aucun secret, cookie, e-mail de fixture ou chaîne de connexion. Les sorties partageables se trouvent sous `outputs/` et doivent respecter la même règle.
