# SAAS-02 — indicateurs locaux en lecture seule

Cette tranche expose une vue de santé SaaS réservée au `SUPER_ADMIN`. Elle ne crée aucune donnée : trois lectures Prisma agrègent le journal de facturation, les confirmations de l'adaptateur fictif et les compteurs SaaS déjà présents.

## Période et sources

La période est le mois civil UTC, borne de début incluse et borne de fin exclue.

| Indicateur | Définition locale | Source existante |
|---|---|---|
| Abonnements confirmés HT | Somme HT brute des factures EUR entièrement payées, rattachées au mois par `dueAt`, pour les motifs création, cycle ou mise à jour ; ajout du devis HT du premier paiement fictif confirmé quand aucun compte de facturation ne lui est rattaché | `SaasBillingAccount.state.invoices`, `SignupPaymentEvent`, `SignupJourney.quoteSnapshot` |
| Dépassements confirmés HT | Somme HT brute des factures EUR entièrement payées dont le motif est `usage` ou `subscription_usage` | `SaasBillingAccount.state.invoices` |
| Activations | Souscriptions commerciales dont `startsAt` appartient au mois | `SaasSubscription` |
| Commandes | Somme de `orderCount` des périodes d'usage qui commencent dans le mois ; inclus et dépassements restent visibles séparément | `SaasUsagePeriod` |
| Livreurs | Comptes `DRIVER` actifs ou en attente de vérification à la date de lecture | `User` et `Role` de l'entreprise souscrite |
| Options / sièges | Quantité des éléments de souscription effectifs à la date de lecture | `SaasSubscriptionItem` |

Le détail est groupé par Starter, Pro et Business, puis présenté pour au plus 50 souscriptions commerciales récentes. Les totaux portent sur toute la lecture, pas seulement sur ces 50 lignes. Les pilotes sont exclus. Business utilise exactement les mêmes compteurs : aucune limite ou consommation n'est supposée.

Les factures de prestations de livraison restent dans l'indicateur historique `deliveryInvoicesPaidThisMonth`. Elles ne sont jamais additionnées au revenu SaaS.

## Garde-fous

- une facture incomplète, non EUR, non entièrement payée ou de motif inconnu est exclue ;
- un identifiant de facture déjà lu n'est compté qu'une fois ;
- seul le premier événement confirmé de l'adaptateur fictif peut compter, et seulement si son TTC correspond exactement au devis ;
- un parcours déjà rattaché à un compte de facturation n'est pas recompté par son événement d'inscription ;
- la route et le client utilisent `no-store` ;
- le service n'appelle que `findMany` et ne persiste aucun agrégat.

## Limites de la tranche

Le montant est un **indicateur brut issu du journal local**, pas un chiffre financier réconcilié. Il peut inclure un paiement fictif et ne prouve aucun encaissement bancaire. Le journal ne conserve pas de date d'encaissement distincte de l'échéance, ni la ventilation HT et la date comptable d'un remboursement : les remboursements sont signalés mais ne sont pas déduits.

Aucun taux de conversion ou de rétention, coût, marge ou seuil d'alerte n'est calculé sans historique et règle validés. La lecture de l'état JSON complet des comptes de facturation devra être bornée ou remplacée par une source comptable adaptée avant un volume réel important. Cette tranche n'effectue aucune réconciliation Stripe et ne modifie ni quota ni droit.

## Vérification locale

```bash
npm run test:saas02
npm run check
npm run build
```

Les tests couvrent les bornes UTC, la séparation abonnement/dépassement/livraison, la déduplication de l'adaptateur fictif, l'exclusion des pilotes, les trois formules dont Business, les écritures invalides et l'absence de requête d'écriture.
