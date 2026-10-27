# SAAS-03 — consultation locale de l’abonnement

Date : 24 octobre 2026. Portée : vue et API locales en lecture seule. Aucun paiement, appel Stripe, migration, seed, déploiement ou donnée distante n’a été utilisé. Une tentative d’authentification Supabase a été lancée par la recette navigateur, mais aucune connexion n’a abouti (`ENOTFOUND`).

## Livré

- Page `/settings/subscription`, intitulée « Mon abonnement », ajoutée à la seule navigation `COMPANY_ADMIN`.
- Endpoint `GET /api/billing/subscription` réservé à `COMPANY_ADMIN`, isolé sur l’entreprise de session et sans cache.
- DTO filtré : formule, périodicité, période, options, consommation, alertes 80/100/120, statut/résiliation/changement en attente et historique opération/facture trié/dédupliqué.
- État vide lorsqu’aucun compte/contrat actif n’existe ; erreur de lecture visible. Aucun état JSON brut, entrée/résultat d’opération, identifiant fournisseur ou secret n’est renvoyé.
- Vue sans bouton ni action de mutation ; aucun appel au POST historique `/api/billing`.

## Preuves

```sh
npm run test:saas03
npm run test:saas03:e2e
npm run check
git diff --check
```

Résultats : `npm run test:saas03` 5/5, `npm run check` 371/371 et `git diff --check` réussi. La première recette Playwright n’était pas autonome car elle n’ouvrait pas de session ; elle est retirée comme preuve. La reprise ouvre désormais la session démo COMPANY_ADMIN, mais échoue légitimement avant navigation : login 401 après `ENOTFOUND` sur Supabase. Le middleware n’a pas été contourné ; aucune réussite E2E n’est revendiquée dans ce rapport.

## Limites

Cet incrément ne livre aucune mutation payante : changements de formule/options, moyen de paiement, résiliation, export DATA-02 et fournisseur réel restent ouverts dans SAAS-03. Les données sont issues du journal sandbox local et ne constituent pas une réconciliation Stripe réelle. La preuve navigateur reste à rejouer lorsque l’authentification Supabase locale est joignable.
