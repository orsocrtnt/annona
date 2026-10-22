# Audit de fusion — roadmap SaaS autonome

Date : 21 octobre 2026.

## Objet

Réconcilier la nouvelle ambition de commercialisation autonome avec la TODO existante sans supprimer les tâches historiques, sans compter deux fois une fonction déjà développée et sans activer de paiement réel, modifier la production ou engager une dépense.

## Éléments inspectés

- schéma Prisma et migrations disponibles ;
- routes, pages et services d'authentification, entreprise, rôles, dispatch, portail client, livreur, onboarding, support, facturation de prestations et administration plateforme ;
- tests liés aux frontières multi-tenant, invitations, récurrences, duplication, onboarding et fiabilité ;
- documentation de préproduction, offres, pilotes, opérations, conservation et décisions commerciales ;
- TODO centrale et critères de sortie existants.

## État réel constaté

### Déjà développé

- préproduction Supabase distincte, Preview Vercel, branche GitHub et CI connectée ;
- trois espaces administrateur, client et livreur ;
- isolation multi-tenant et contrôles de rôles principaux ;
- commande, affectation, prise en charge, suivi, échanges, preuve, incident, historique et export comptable ;
- commandes récurrentes et génération planifiée ;
- duplication d'une ancienne commande ou livraison dans un nouveau formulaire modifiable ;
- inscription entreprise avec vérification de l'adresse e-mail ;
- assistant interne en sept étapes, calculé depuis les données existantes ;
- accueil public de présentation ;
- première vue SUPER_ADMIN des entreprises, utilisateurs, livraisons et revenus des prestations ;
- démonstrations isolées, mais trop lentes lors de la première création distante.

### Partiellement développé

- l'inscription ne choisit ni offre ni options et ne conditionne pas l'activation à un paiement ;
- les coordonnées juridiques et de facturation de l'entreprise ne sont pas collectées dans le parcours actuel ;
- l'onboarding n'est pas encore relié à une souscription et ses invitations e-mail réelles restent à qualifier ;
- sauvegarde et restauration sont maintenant exercées sur une cible fournisseur isolée ; monitoring et alertes restent partiels ;
- la page publique ne constitue pas encore le site commercial complet ;
- l'administration plateforme ne connaît ni souscription, pilote, quota, option, paiement SaaS ni commission ;
- la performance unitaire est mesurée, mais pas la capacité de 1 à 100 entreprises.

### Absent du code

- catalogue versionné Starter/Pro/Business et options ;
- modèles de souscription, éléments souscrits, droits effectifs et compteurs de période ;
- limites commerciales appliquées côté serveur et dépassements facturables ;
- paiement Stripe sandbox et réconciliation de webhooks ;
- orchestration persistante de l'inscription autonome ;
- page « Mon abonnement » et alertes de quota ;
- découverte premium de 60 jours ;
- attribution commerciale et écritures de commission ;
- modèle détaillé de coûts pour 1, 10, 50 et 100 entreprises ;
- supervision interne consolidée du SaaS.

## Fusion retenue

Les tâches existantes restent la source de vérité pour l'infrastructure, la sécurité, les e-mails, l'onboarding, les cartes, le design, les pilotes, le site et la recette de mise en vente. Les nouveaux identifiants servent seulement aux responsabilités qui n'avaient aucun équivalent vérifiable :

- `DEMO-2` : ouverture rapide et pool isolé de démonstrations ;
- `SIGNUP-1` : inscription autonome et activation atomique ;
- `SAAS-03` : gestion autonome de l'abonnement ;
- `SAAS-04` : découverte premium de 60 jours ;
- `SALES-1` : attribution et commissions ;
- `PERF-02` : charge et capacité multi-entreprises ;
- `COST-1` : coûts d'exploitation et coût marginal ;
- `ADMIN-1` : supervision interne du SaaS.

`SAAS-01A` est recentrée sur le catalogue, les droits et les quotas. `SAAS-01B` couvre Stripe et la facturation en environnement fictif. `GROWTH-1`, `ONBOARD-1` et `OFFER-1` sont complétées sans créer de doublons.

## Décisions commerciales intégrées

- Starter : 79 € HT/mois ou 790 € HT/an ; Pro : 179 € ou 1 790 € ; Business : 349 € ou 3 490 € ;
- les options et utilisateurs supplémentaires sont facturés douze mois sans remise annuelle de deux mois ;
- les dépassements sont facturés sur la période, sans packs ;
- le mini-administrateur peut agir comme dispatcher ; son quota/prix Starter et Pro reste à décider ;
- commissions de travail : apporteur 15 %, accompagné 25 %, autonome 35 %, pendant douze mois maximum sur les éléments initiaux HT réellement encaissés ;
- les pilotes gratuits et la découverte premium payante de 60 jours sont deux régimes distincts ;
- aucun paiement réel, versement de commission ou document fiscal définitif avant les validations requises.

## Décisions encore nécessaires avant finalisation

- prorata et date d'effet des changements de formule ;
- traitement exact des impayés et suspensions ;
- règles de remboursement ;
- quota et tarif du mini-administrateur/dispatcher pour Starter et Pro ;
- politique d'usage raisonnable Business ;
- fournisseur final de paiement et traitement fiscal/facturation applicable ;
- validation juridique des contrats et commissions.

## Ordre d'exécution recommandé

1. restauration complète et performance de la démo ;
2. catalogue, souscriptions, droits et quotas ;
3. inscription persistante avec faux paiement ;
4. Stripe sandbox, libre-service, découverte premium et attribution commerciale ;
5. e-mails, monitoring, charge, GPS physique et coûts ;
6. design, site commercial, onboarding et supervision ;
7. trois pilotes accompagnés ;
8. paiement réel et mise en vente après validation explicite.

## Limites de cet audit

Aucune migration, donnée distante, variable d'environnement, ressource fournisseur ou logique applicative n'a été modifiée. L'audit qualifie la présence du code et de ses preuves existantes ; il ne valide pas encore les nouvelles fonctions SaaS, qui restent à implémenter et tester selon leurs critères dans la TODO.
