# Architecture cible des offres, quotas et commissions

Ce document prépare l'architecture sans ajouter de schéma ni activer de paiement. Les montants et règles confirmés sont dans `DECISIONS_PRODUIT_COMMERCIALES.md`.

## Principes

- un catalogue versionné décrit formules, options, prix, périodicités, inclusions et dépassements ;
- une souscription conserve un instantané du catalogue accepté ;
- les droits serveur sont dérivés de la souscription active, jamais du navigateur ou d'une page de retour de paiement ;
- les quotas sont calculés par entreprise et période de facturation ;
- les usages Business « illimités » restent mesurés, protégés par une politique d'usage raisonnable et des alertes de coût ;
- l'abonnement TutelLiv reste distinct des prestations de livraison et de leur export comptable ;
- les changements sont datés et prennent effet selon une règle explicite, sans réécrire l'historique.

## Objets métier à prévoir

1. **Version de catalogue** : devise, TVA affichée, période de validité, formules et options.
2. **Souscription entreprise** : formule, périodicité, début/fin, état, prochain renouvellement et instantané contractuel.
3. **Éléments souscrits** : quantités et options achetées initialement ou ajoutées ensuite.
4. **Droits effectifs** : fonctions autorisées et plafonds résolus côté serveur.
5. **Compteurs d'usage** : commandes, livreurs et administrateurs actifs sur la période.
6. **Événements de cycle de vie** : souscription, changement, impayé, reprise, résiliation et export.
7. **Attribution commerciale initiale** : apporteur/commercial, niveau, date, éléments initiaux éligibles et durée maximale.
8. **Écritures de commission** : encaissement source, base HT, taux, montant, statut et éventuelle régularisation.

## Règles critiques

La découverte premium Starter/Pro dure 60 jours à partir d'une souscription payante. Elle ouvre les fonctions premium éligibles sans augmenter les plafonds de livreurs, administrateurs ou commandes.

Les options incluses dans une formule ne sont pas facturées une seconde fois. Une option ajoutée en cours de contrat devient un élément distinct mais ne modifie pas la base de commission de la vente initiale.

Un dépassement de commandes est compté de manière idempotente à partir des commandes qualifiées dans la période. Annulations, suppressions, fuseaux horaires et changements de formule doivent être définis avant facturation réelle.

Le pilote gratuit utilise un droit temporaire séparé du catalogue commercial. Il possède une date de fin, des limites convenues et un export de sortie ; il ne crée ni facture ni découverte premium.

## Commission sans CRM complexe

Une attribution commerciale est fixée à la souscription initiale et ne peut être modifiée sans trace d'audit. Chaque encaissement admissible pendant douze mois au maximum produit au plus une écriture de commission. Un remboursement ou impayé produit une régularisation liée à l'écriture d'origine.

Le système doit expliquer : qui a apporté la vente, quel niveau s'applique, quels éléments initiaux sont éligibles, quel montant HT a réellement été encaissé et pourquoi le calcul a produit ce résultat. Le contrat devra confirmer les taux, le fait générateur, la TVA, les remboursements et la fin de relation.

## Séquence recommandée

1. Valider coûts et acceptation de la grille pendant les entretiens.
2. Implémenter les droits et quotas configurables sans paiement réel.
3. Utiliser un registre de pilote gratuit puis, si nécessaire, une souscription manuelle.
4. Tester les compteurs et changements de formule avec des données fictives.
5. Après les pilotes, choisir le fournisseur et brancher son environnement de test.
6. N'accorder un droit qu'après un événement serveur authentifié et idempotent.

Stripe est prioritaire à l'étude, sans décision définitive. Les tarifs actuels affichés en France sont notamment 1,5 % + 0,25 € pour une carte standard de l'Espace économique européen et 0,7 % du volume pour Stripe Billing en paiement à l'utilisation ; ils devront être revérifiés avant choix : [Stripe France](https://stripe.com/fr/pricing).
