# SAAS-01A — Noyau des offres, droits et quotas

Date de clôture : 22 octobre 2026.

## Résultat

Le noyau SaaS est disponible sans paiement réel : catalogue C7 versionné, offres Starter/Pro/Business, options, souscriptions commerciales, pilotes, compatibilité historique, instantanés contractuels, périodes de consommation et réservations de sièges concurrentes.

Les droits sont calculés côté serveur. Starter, Pro et Business incluent respectivement 0, 1 et 1 dispatcher ; l'ajout est centralisé à 8 € HT/mois ou 96 € HT/an. Une fonction déjà incluse dans l'offre est refusée comme option payante. Les changements créent des périodes d'effet successives au lieu de réécrire le passé.

Les invitations de livreurs, dispatchers et mini-administrateurs utilisent une réservation atomique avant l'appel au fournisseur d'e-mail. Le dispatcher dédié reste limité au dispatch, sans accès aux comptes, paramètres ou factures. L'interface d'invitation propose ce rôle. Le plafond du premier administrateur est porté par l'activation de la souscription et sera consommé par SIGNUP-1.

Chaque commande métier créée produit un événement idempotent dans une période mensuelle UTC. Le quota ne bloque pas la commande ; le dépassement est calculé une seule fois. Les seuils 80 %, 100 % et 120 % sont centralisés pour les futures alertes. Les statuts `RESTRICTED` et `READ_ONLY` matérialisent les règles d'impayé confirmées.

Les routes du dispatch automatique, des cartes GPS administrateur/client et des analytics avancés vérifient l'option ou l'offre côté serveur. L'interface seule ne peut donc pas activer une fonction absente. Les vues autorisées restent consultables en lecture seule, tandis que le lancement manuel ou différé d'un auto-dispatch y est refusé.

## Compatibilité et isolation

Les entreprises déjà présentes sont migrées vers `LEGACY` avec tous leurs accès, sans abonnement payant inventé. Les nouvelles sessions de démonstration isolées reçoivent un pilote limité à huit heures. Les offres commerciales, pilotes et prestations de livraison restent dans des modèles séparés.

Les neuf nouvelles tables sont sous RLS et n'accordent aucun droit direct à `anon`, `authenticated` ou `PUBLIC`. Toutes les lectures et écritures métier restent bornées par l'entreprise transmise au service serveur.

## Preuves

- `npm run check` : types, lint strict et 295 tests réussis.
- `npm run build` : compilation de production réussie, 103 pages générées.
- répétition migration/restauration : 29/29 tables restaurées à l'identique, trois migrations, zéro drift, schémas temporaires supprimés, schéma public et données inchangés ; preuve `outputs/db1/migration-restore-rehearsal.json`.
- migration appliquée sur la préproduction isolée ; contrôle final : 29 tables applicatives sous RLS, trois migrations, zéro droit public, catalogue RBAC exact, données de démonstration contrôlées et zéro drift ; preuve `outputs/db1/preproduction-validation.json`.

Aucun paiement réel, push, déploiement Vercel ou déploiement en production n'a été effectué.
