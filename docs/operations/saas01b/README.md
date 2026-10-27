# SAAS-01B — Facturation sandbox Stripe

État de référence : 27 octobre 2026. Le journal, l’adaptateur et les routes existent. Un compte Stripe de test est branché sur le développement local (`tutelliv-dev`) ; la préproduction reste sur le paiement fictif.

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

## Recette sandbox réelle (27 octobre 2026)

Prérequis : `npm run env2:verify-dev` vert, `SIGNUP_PAYMENT_ADAPTER=stripe-sandbox` et clés `sk_test_…`/`whsec_…` dans `.env.local`, serveur sur le port 3108, puis dans un terminal :

```bash
stripe listen --all-snapshot --forward-to localhost:3108/api/billing/webhook
```

Le secret affiché par `stripe listen --print-secret` reste stable d'une session à l'autre. Résultats :

| Scénario | Résultat |
|---|---|
| Checkout carte 4242 | Entreprise activée après facture payée (94,80 € TTC) |
| Abandon sur Stripe, carte refusée | Inscription conservée, aucune entreprise |
| 3D Secure | Défi validé, entreprise activée |
| Signature absente ou forgée | 400 |
| Événement rejoué | Aucun effet, aucun doublon |
| Changement Starter → Pro → Business | Prorata payé, consentement au centime ; formule active refusée (`PLAN_CHANGE_NOOP`) |
| Résiliation | Fin de période, entreprise et historique conservés |
| Remboursement | Un seul remboursement Stripe pour deux `--apply` identiques |
| Horloge de test | Renouvellement payé ; refusé → `PAST_DUE`, droits non prolongés ; régularisation → `ACTIVE` |

Sur Checkout, décocher « Enregistrer mes informations avec Link », sinon un numéro de téléphone est exigé. Hors zone euro, Stripe propose le dollar tant que la tarification adaptative (Adaptive Pricing) est active.

## Remboursement opérateur

```bash
npm run billing:refund -- --invoice in_… --amount 1000 --operator ops@tutelliv.fr --reason "Motif d'au moins dix caractères"
```

Sans `--apply`, le script affiche la facture, le montant remboursable et la clé, sans rien envoyer. Avec `--apply`, il exige `TUTELLIV_OPERATOR_ACCESS_TOKEN`, session Supabase personnelle et temporaire d'un `SUPER_ADMIN` actif ; l'adresse passée en argument n'est jamais une preuve d'identité. Il rapproche Stripe avant la décision, journalise motif, montant et acteur authentifié, applique le remboursement puis exige un nouveau rapprochement réussi. La clé dépend uniquement de la facture et du montant : modifier le motif ne permet pas de doubler une opération. Le script npm lit `.env.local` ; pour une autre cible, lancer `tsx scripts/saas01b/refund.ts` avec son propre fichier d'environnement.

## Limites

Les justificatifs Stripe test ne valent pas facture électronique française. SAAS-03 porte l’écran « Mon abonnement ». Aucun paiement réel, aucune clé live, aucun déploiement Production.
