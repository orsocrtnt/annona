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

Elle ne décide pas du sort d'une baisse bloquée (refus ou planification) ni du remplacement d'une option incompatible : ce sont des décisions du propriétaire. Aucune route, aucun écran et aucune écriture ne l'utilisent encore. Preuve : `npm run test:saas03` (cas réels du catalogue C9).
