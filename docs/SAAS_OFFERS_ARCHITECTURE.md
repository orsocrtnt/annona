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

Pour une formule annuelle, la remise de deux mois porte uniquement sur la formule de base. Les options et utilisateurs supplémentaires sont facturés sur douze mois sans cette remise. Les dépassements de commandes sont mesurés puis facturés sur la période, sans système de packs prépayés.

Le dispatcher commercial correspond au rôle technique limité de mini-administrateur disposant des permissions de dispatch. Starter en inclut zéro, Pro un et Business un. Un dispatcher supplémentaire coûte 8 € HT/mois dans chaque offre et douze mensualités sur une formule annuelle, sans remise. Il peut créer et organiser les commandes, affecter les livreurs, suivre les livraisons et traiter les incidents ; les abonnements, paiements et paramètres sensibles restent refusés côté serveur.

Un dépassement de commandes est compté de manière idempotente à partir des commandes qualifiées dans la période. Annulations, suppressions, fuseaux horaires et changements de formule doivent être définis avant facturation réelle.

Le pilote gratuit utilise un droit temporaire séparé du catalogue commercial. Il possède une date de fin, des limites convenues et un export de sortie ; il ne crée ni facture ni découverte premium.

## C7 — Règles confirmées et frontières stables

SAAS-01A peut figer les quantités, le prix et les permissions du dispatcher ainsi que les périodes mensuelles de quotas. Il doit fournir les états, dates, compteurs et événements nécessaires au cycle de vie. Prix, seuils et délais restent centralisés et versionnés au lieu d'être dispersés dans l'interface.

Les règles de changement, dépassement, impayé, résiliation, remboursement, support et périodicité sont confirmées dans `DECISIONS_PRODUIT_COMMERCIALES.md`. Leur calendrier doit être représentable par configuration et testé comme machine d'états auditable ; aucune interface ne peut accorder un droit ou modifier seule la situation contractuelle.

Stripe sait prévisualiser les proratas, facturer immédiatement un prorata et garder une modification en attente si son paiement échoue. TutelLiv prépare donc une augmentation, collecte son paiement, puis accorde les nouveaux droits seulement après l'événement serveur vérifié. Les diminutions et suppressions sont planifiées au prochain renouvellement. Le passage mensuel vers annuel est immédiat après crédit et paiement ; le passage annuel vers mensuel attend l'échéance annuelle. Sources officielles : [mise à jour d'un abonnement](https://docs.stripe.com/api/subscriptions/update) et [configuration du portail client](https://docs.stripe.com/api/customer_portal/configurations/create).

Les dépassements correspondent au modèle « forfait fixe + dépassement » de Stripe, mais TutelLiv reste la source auditable de l'usage qualifié. Les commandes ne sont pas bloquées au quota. Chaque commande facturable produit au plus un événement interne idempotent ; une correction conserve le lien avec l'événement initial. Les compteurs se réinitialisent par mois civil ou contractuel explicitement défini, y compris pour un abonnement annuel. À 80 %, 100 % et 120 %, une alerte et une estimation du supplément sont produites. Les événements de mesure Stripe étant traités de manière asynchrone, l'interface ne doit pas prendre leur agrégat immédiat comme seule vérité. Sources officielles : [tarification récurrente et dépassements](https://docs.stripe.com/billing/subscriptions/metered-billing/thresholds) et [événements de mesure](https://docs.stripe.com/api/billing/meter-event).

La restriction opérationnelle après impayé appartient à TutelLiv : elle ne doit pas être déduite directement d'un seul statut Stripe. L'état local conserve paiement attendu, dernières tentatives, prochaine action, niveau de restriction et justification ; les webhooks mettent cet état à jour de manière idempotente. Une première souscription ne crée aucun droit payant avant paiement confirmé. Pour un abonnement actif : J0 avertissement et nouvelle tentative, J3/J7 rappels, J14 refus des nouvelles commandes sans interrompre les livraisons engagées, puis J30 lecture seule avec régularisation, consultation des documents et export. Aucune donnée n'est automatiquement supprimée.

Une résiliation demandée à tout moment est programmée en fin de période payée sans remboursement automatique. Les usages et éléments de facture encore en attente doivent être rapprochés explicitement avant la clôture. Une erreur de facturation est corrigée ; une situation exceptionnelle justifiée peut donner lieu à remboursement ou avoir après décision tracée. Source officielle : [annulation d'un abonnement](https://docs.stripe.com/api/subscriptions/cancel).

Le support standard de Starter et Pro conserve un objectif interne de première réponse sous un jour ouvré. Business et l'option prioritaire reçoivent un traitement privilégié, sans promesse contractuelle initiale de réponse sous deux ou quatre heures.

## Commission sans CRM complexe

Une attribution commerciale est fixée à la souscription initiale et ne peut être modifiée sans trace d'audit. Chaque encaissement admissible pendant douze mois au maximum produit au plus une écriture de commission. Un remboursement ou impayé produit une régularisation liée à l'écriture d'origine.

Le système doit expliquer : qui a apporté la vente, quel niveau s'applique, quels éléments initiaux sont éligibles, quel montant HT a réellement été encaissé et pourquoi le calcul a produit ce résultat. Le contrat devra confirmer les taux, le fait générateur, la TVA, les remboursements et la fin de relation.

Les taux de travail confirmés sont 15 % pour un apporteur d'affaires, 25 % pour un commercial accompagné et 35 % pour un commercial autonome, pendant douze mois maximum. Ils remplacent l'ancienne hypothèse 25/35/50 %.

## Séquence recommandée

1. Produire immédiatement une première estimation documentaire des coûts avec les tarifs publics et les volumes Starter, Pro et Business ; remplacer ensuite ces hypothèses par les mesures de charge et les données des pilotes.
2. SAAS-01A est implémenté sans paiement réel : catalogue versionné, registre pilote/souscription, droits serveur, options, quotas et compteurs, avec migration et restauration vérifiées sur préproduction isolée.
3. Utiliser ce même moteur pour les trois pilotes, dont les comptes et droits peuvent être créés manuellement, sans les confondre avec une souscription payante ni avec la découverte premium.
4. Construire SIGNUP-1 avec un faux paiement déterministe dès que les interfaces de SAAS-01A sont stables ; vérifier l'idempotence, la reprise après interruption et le refus d'activation sans confirmation serveur.

## État du noyau au 22 octobre 2026

Le catalogue `C7-2026-10-21` a été remplacé comme catalogue actif par `C8-2026-10-23`, puis par `C9-2026-10-24` pour les nouveaux contrats : Business passe à 20 livreurs inclus et 50 maximum, à 9 € HT le siège supplémentaire. `C10-2026-10-29` (décision C12) renomme l'option `AUTO_DISPATCH` en « Dispatch intelligent » et la porte à 39 € HT par mois en Starter (468 € par an), le reste de C9 étant recopié à l'identique. C7, C8 et C9 restent historisés. Les prix sont stockés en centimes, les annuels des options correspondent à douze mensualités et les instantanés d'offre/option préservent l'historique lors d'un changement.

Chaque entreprise possède désormais un état explicite `COMMERCIAL`, `PILOT` ou `LEGACY`. La migration conserve les entreprises existantes en `LEGACY` sans inventer d'activation payante. Les sessions de démonstration isolées reçoivent un pilote limité à leur durée de huit heures ; une nouvelle inscription antérieure au futur parcours autonome reste explicitement historique.

Le résolveur central calcule les fonctions et plafonds effectifs à partir de l'instantané contractuel et des éléments actifs. Les invitations réservent atomiquement le dernier siège avant l'appel e-mail. Les commandes standard, coursier, récurrentes et missions spéciales passent par le même contrôle : elles restent possibles au-delà du quota, puis créent un événement idempotent dans la période mensuelle UTC. Le dispatch automatique, les cartes GPS administrateur/client et les analytics avancés sont contrôlés sur les routes serveur, y compris pour une requête forgée.

La migration `20261021010000_saas_core` a été répétée avec sauvegarde/restauration sur deux schémas temporaires, puis appliquée à la préproduction isolée. Les 29 tables applicatives y sont sous RLS, sans droit direct public, les trois migrations sont appliquées et le diff Prisma est vide. Aucun paiement réel ni déploiement de production n'a été effectué.
5. Brancher ensuite Stripe en environnement fictif dans SAAS-01B. Cette sandbox peut être développée avant les pilotes et avant la structure juridique ; elle n'autorise aucun encaissement réel.
6. Ajouter SAAS-03, SAAS-04 et la tranche théorique de SALES-1 à partir des événements stables. N'accorder ou retirer un droit qu'à partir d'un événement serveur authentifié, idempotent et auditable.
7. N'activer les paiements réels qu'après validation de la structure juridique, du compte bancaire, des règles fiscales et de facturation, des contrats et des arbitrages commerciaux encore ouverts.

Stripe est prioritaire à l'étude, sans décision définitive. Les tarifs actuels affichés en France sont notamment 1,5 % + 0,25 € pour une carte standard de l'Espace économique européen et 0,7 % du volume pour Stripe Billing en paiement à l'utilisation ; ils devront être revérifiés avant choix : [Stripe France](https://stripe.com/fr/pricing).
