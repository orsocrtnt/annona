# SAAS-03 — vue locale en lecture seule

État : incrément de consultation du 24 octobre 2026. Il ne réalise aucune modification d’abonnement, paiement, appel Stripe, migration ou seed.

## Accès et données affichées

`/settings/subscription` est proposé uniquement à `COMPANY_ADMIN`. La page lit `GET /api/billing/subscription`, également réservé à ce rôle et filtré sur l’entreprise de la session. La réponse porte seulement sur : formule, périodicité, période, options actives, consommation de commandes, alertes et historique compréhensible d’opérations/factures.

L’endpoint ne renvoie jamais l’état JSON du journal, ni les identifiants fournisseur, entrées/résultats d’opération, secrets ou données d’une autre entreprise. Il répond `Cache-Control: no-store`. Sans compte ou contrat actif, il renvoie `data: null` et la page affiche un état vide ; une panne de lecture produit une erreur lisible.

## Vérifications locales

```sh
npm run test:saas03
npm run test:saas03:e2e
npm run check
git diff --check
```

La recette navigateur ouvre d’abord la session démo locale `COMPANY_ADMIN`, intercepte seulement l’API locale de lecture, bloque toute route Stripe et contrôle clic, retour, rechargement et rendu à 390 px. Aucun POST de facturation n’est appelé. Elle exige donc qu’une authentification Supabase locale déjà configurée soit joignable ; ne pas remplacer cette étape par un faux cookie ou un contournement du middleware.

## Limites

Les changements de formule/options, moyen de paiement, résiliation, export DATA-02 et réconciliation avec un fournisseur réel ne sont pas inclus. Ils restent dans SAAS-03 et nécessitent leurs propres validations serveur et preuves sandbox. Le 24 octobre, la recette E2E n’a pas pu ouvrir cette session : le login a renvoyé 401 après une résolution DNS Supabase indisponible ; ce n’est pas une preuve navigateur réussie.

## Évaluation d'un changement de formule (2026-10-27)

`assessPlanChange` (`src/domains/billing/plan-change.ts`) est une fonction pure, sans base ni effet, qui prépare la future action « changer de formule ». À partir de la formule actuelle, des options souscrites, des comptes facturés occupés et des commandes de la période, elle renvoie :

- le sens (montée, baisse, identique) et le moment d'effet selon C7 : immédiat après paiement du prorata pour une montée, au renouvellement pour une baisse ;
- les limites de sièges de la formule visée, en ne comptant que les options compatibles (`applicablePlans`), dans la limite de son maximum ;
- les dépassements qui bloqueraient (livreurs, administrateurs, dispatchers), les options qui tomberaient et les fonctions perdues ;
- le dépassement de commandes, signalé sans bloquer.

Branchement du 2026-10-27 (décision C10 : une baisse avec ressources en excès est refusée). `assessBillingContractChange` (`src/domains/billing/plan-change.service.ts`) compte les comptes `ACTIVE`/`PENDING_VERIFICATION` de l'entreprise, avec les mini-admins parmi les dispatchers comme le moteur de droits, plus les réservations en cours et les commandes de la période. Il applique les plafonds de la formule visée. `POST /api/billing` l'utilise ainsi :

- `preview` renvoie `assessment` : dépassements, fonctions perdues, dépassement de commandes ;
- `change` répond 409 `PLAN_CHANGE_SEATS_EXCEEDED` avec la liste des dépassements **avant tout appel au fournisseur** dès qu'un compte excède la cible ;
- un abonnement sans contrat actif est refusé sans évaluation.

Ce contrôle est au moins aussi strict que celui de la projection au renouvellement (`BILLING_DOWNGRADE_SEATS_EXCEEDED`). Rien n'est désactivé automatiquement. Le moment d'effet reste donné par `changeTiming`. Le journal auditable des actions est `SaasBillingOperation` (commande, auteur, clé idempotente) : aucune nouvelle table n'est nécessaire.

Preuves : `npm run test:saas03`, `tests/admin01-company-billing-boundary.test.ts` (refus sans appel fournisseur, aperçu, abonnement inactif), et un calcul réel en lecture seule sur une entreprise de préproduction, recoupé par SQL.

## Moyen de paiement et factures (2026-10-27)

Pour un abonnement en ligne (`management: SELF_SERVICE`), « Mon abonnement » ajoute une carte « Moyen de paiement et factures » et un lien « Voir la facture » dans l'historique.

- `POST /api/billing` avec `{ "action": "portal" }` est réservé à `COMPANY_ADMIN`, comme les autres actions. `BillingService.paymentPortal` ouvre une session du portail client Stripe et renvoie son adresse. Le navigateur y est redirigé, sans conserver le lien.
- Le portail est limité au changement de carte et à l'historique des factures, qui permet aussi de régler une facture en attente. Changement de formule, résiliation et coordonnées y sont désactivés : ces actions restent journalisées par TutelLiv. La configuration Stripe porte la métadonnée `tutelliv_portal=payment-method-v1`. Elle est retrouvée par cette métadonnée et n'est jamais dupliquée, même après les 24 h de validité d'une clé d'idempotence.
- Chaque ouverture est journalisée dans `SaasBillingOperation` (`kind: PAYMENT_PORTAL`, auteur, statut `DONE` ou `FAILED` avec un code). Elle apparaît dans l'historique sous « Accès au moyen de paiement ». Le lien du portail donne accès au compte : il n'est jamais enregistré. Aucun verrou d'abonnement n'est pris, car rien n'est modifié chez TutelLiv. Une carte changée ou une facture réglée revient par le webhook et le rapprochement habituels.
- Le portail est refusé si l'abonnement n'a pas de contrat actif, s'il est résilié (`CANCELLED`) ou s'il est géré par l'équipe. Il reste ouvert en cas d'impayé, pour permettre de changer de carte.
- Un lien de facture n'est affiché que pour une adresse `https://invoice.stripe.com/…` sans identifiants ; toute autre valeur est ignorée.

Preuves : `tests/saas03-payment-portal.test.ts` (configuration limitée et réutilisée, abonnement étranger et adresse hors Stripe refusés, journal sans lien, états refusés, liens de facture filtrés) et `tests/e2e/saas03.spec.ts` (lien de facture, erreur puis redirection vers un portail factice, 390 px sans débordement). Essai réel sur le compte Stripe de test, avec un abonnement de la recette SAAS-01B dans `tutelliv-dev` : session `billing.stripe.com` en HTTP 200, deux ouvertures donnant deux sessions, journal sans lien, 2 factures sur 2 avec un lien.

## Options en libre-service (2026-10-27)

« Mon abonnement » ajoute la carte « Options et comptes supplémentaires » quand un changement est possible (`canChange`). Le dialogue liste les options de la formule actuelle avec leur prix HT : une case par option, et des boutons − / + pour les comptes livreurs, administrateurs ou dispatchers. Les plafonds viennent des limites de sièges de la formule ; une option déjà incluse ou réservée à une autre formule n'est pas proposée.

Aucune nouvelle route : la sélection passe par l'aperçu puis par le changement existants de `POST /api/billing`, avec la même formule et la même périodicité. Le serveur reste juge : devis (`SIGNUP_*_LIMIT_EXCEEDED`, option incluse), sièges en excès (409 `PLAN_CHANGE_SEATS_EXCEEDED`), moment d'effet (`changeTiming` : un ajout est immédiat après prorata, un retrait prend effet au renouvellement), consentement au montant exact, clé idempotente et journal `SaasBillingOperation`. L'aperçu n'est demandé qu'une fois les clics terminés (400 ms), pour ne pas multiplier les appels au fournisseur. `GET /api/billing` expose désormais le nom, le type et les prix de chaque option, ainsi que les sièges inclus et maximaux de chaque formule, sans identifiant interne.

Preuves : `tests/saas03-options.test.ts` (plafonds identiques au devis serveur, API sans identifiant interne) et `tests/e2e/saas03.spec.ts` (option cochée et deux comptes ajoutés, bouton + bloqué au plafond, un seul aperçu, montant confirmé, 390 px). Aperçu réel sur le compte Stripe de test : ajout du dispatch automatique à un Starter mensuel, immédiat, 34,52 € TTC au prorata.
