# SAAS-01B — Facturation sandbox Stripe

État de référence : 24 octobre 2026. Le journal, l’adaptateur et les routes existent. Aucun compte Stripe n’est encore provisionné ; l’adaptateur actif reste le paiement fictif.

## Garde

- `SIGNUP_PAYMENT_ADAPTER=stripe-sandbox` uniquement en local ou Preview.
- `VERCEL_ENV=production` et toute clé `sk_live_*` sont refusés.
- Checkout, webhooks et snapshots n’accordent un droit qu’après lecture serveur d’une facture payée au bon montant, à la bonne TVA et au bon contrat.
- Un retour navigateur, une session Checkout incomplète ou un événement désordonné ne créent pas d’entreprise.

## Recette locale sans compte Stripe

```bash
npm run check
npm run test:saas01b
npm run test:saas01b:e2e
```

`test:saas01b` démarre un PostgreSQL isolé sur `127.0.0.1:55439` (Docker `postgres:16-alpine` s’il est disponible, sinon PostgreSQL 15 Homebrew dans `/tmp/tutelliv-saas01b-pg`), pousse le schéma Prisma, charge C8/C9, active le RLS du journal, exécute le double de fournisseur, puis détruit l’instance. Les migrations OPS-03B (`http`, `pg_cron`, Vault) restent hors de ce harnais local. Ce n’est **pas** une recette Stripe sandbox.

## Activation sandbox (quand un compte test existe)

1. Créer un compte Stripe test TutelLiv. Ne jamais coller une clé secrète dans le chat.
2. Déposer `STRIPE_SECRET_KEY` (`sk_test_…`) et `STRIPE_WEBHOOK_SECRET` (`whsec_…`) dans un fichier local ignoré, jamais dans Git.
3. Appliquer C9 puis le journal `saas_billing_*` sur la cible de recette isolée, pas en Production.
4. Passer `SIGNUP_PAYMENT_ADAPTER=stripe-sandbox` seulement sur cette cible.
5. Brancher le webhook `/api/billing/webhook` en mode test.
6. Rejouer : Checkout carte test, rechargement, événement dupliqué, impayé, renouvellement, annulation, remboursement.

Le cron `/api/cron/billing` ne s’exécute que si l’adaptateur vaut `stripe-sandbox`. Tant que l’inscription utilise `fake`, il répond `{ skipped: true }`.

## Limites

Les justificatifs Stripe test ne valent pas facture électronique française. SAAS-03 porte l’écran « Mon abonnement ». Aucun paiement réel, aucune clé live, aucun déploiement Production.
