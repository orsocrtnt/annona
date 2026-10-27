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
