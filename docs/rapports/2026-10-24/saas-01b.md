# SAAS-01B — Facturation sandbox, tranche locale

Date : 24 octobre 2026.
Branche : `preproduction`.
La case TODO reste ouverte : aucun compte Stripe n’existe encore.

## Résultat

SIGNUP-1 peut basculer de l’adaptateur fictif vers `stripe-sandbox` sans accorder de droit sur un retour navigateur. Le journal `saas_billing_accounts` / `saas_billing_operations` mémorise Checkout, changements, usage, résiliation et remboursements. Un événement Stripe n’est qu’un réveil : l’état monétaire est relu chez le fournisseur, puis rapproché.

Le catalogue actif pour les **nouveaux** contrats est `C9-2026-10-24` : Business 20 livreurs inclus, 50 maximum, 9 € HT le siège 21 à 50. C8 reste historisé. L’adaptateur par défaut du dépôt reste `fake`.

Le cron `/api/cron/billing` est enregistré mais s’arrête avec `{ skipped: true }` tant que l’adaptateur n’est pas `stripe-sandbox`. Production et `sk_live_*` restent refusés.

## Preuves locales

- tests métier/transport : `tests/billing.test.ts` (signatures, TVA, doublons, renouvellement incohérent, garde Production, cron inerte, notice cancelled) ;
- recette PostgreSQL isolée : `npm run test:saas01b` (`127.0.0.1:55439`, Docker ou PostgreSQL 15 Homebrew, schéma Prisma + C8/C9, fournisseur simulé, crash d’usage sans fermer la période) ;
- Chrome sans réseau Stripe : `npm run test:saas01b:e2e` 3/3 (Checkout fictif, rechargement, cancelled, erreur 503 mobile).

Le fournisseur simulé ne remplace pas une carte test Stripe ni un webhook signé par Stripe.

## Limites

- Pas de compte Stripe, pas de clé test, pas de webhook réel.
- Migrations C9 / journal non appliquées sur la préproduction distante (volontaire, en attendant la sandbox).
- Justificatif Stripe test ≠ facture électronique française.
- SAAS-03 (écran Mon abonnement) et l’achat d’extras depuis l’invitation restent hors périmètre.
- Aucun paiement réel, aucun secret dans Git, aucun déploiement Production.

Procédure : [SAAS-01B](../../operations/saas01b/README.md).
