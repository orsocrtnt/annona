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

Le montant est un **indicateur issu du journal local**. Il peut inclure un paiement fictif et ne prouve aucun encaissement bancaire ; le rapprochement avec le fournisseur se fait à part (section suivante). Depuis le 27 octobre 2026, `refundedHtCents` déduit les remboursements des factures comptées dans le mois, et `netPaidHtCents` donne abonnements et dépassements nets. Le fournisseur ne donnant pas la date d'un remboursement, celui-ci suit le mois de sa facture ; son HT est ventilé au prorata de la facture, à titre provisoire et sans validation comptable. Le brut `subscriptionPaidHtCents` reste inchangé.

Aucun taux de conversion ou de rétention, coût, marge ou seuil d'alerte n'est calculé sans historique et règle validés. La lecture de l'état JSON complet des comptes de facturation devra être bornée ou remplacée par une source comptable adaptée avant un volume réel important. Cette tranche n'effectue aucune réconciliation Stripe et ne modifie ni quota ni droit.

## Vérification locale

```bash
npm run test:saas02
npm run check
npm run build
```

Les tests couvrent les bornes UTC, la séparation abonnement/dépassement/livraison, la déduplication de l'adaptateur fictif, l'exclusion des pilotes, les trois formules dont Business, les écritures invalides et l'absence de requête d'écriture.

## Rapprochement avec le fournisseur (2026-10-27)

`npm run saas02:reconcile -- AAAA-MM outputs/saas02/reconciliation-AAAA-MM.json` compare, pour chaque compte de facturation relié à un abonnement Stripe de test, les factures du journal local (`SaasBillingAccount.state.invoices`) aux factures relues chez Stripe. Le script ne fait que des lectures Prisma et des GET Stripe ; la garde sandbox de l'adaptateur s'applique. La sortie détaillée, en mode `0600` dans `outputs/` (ignoré par Git), contient des identifiants de facture ; la console n'affiche que des totaux.

| Résultat | Définition |
|---|---|
| Encaissé HT (fournisseur) | Sous-total HT des factures EUR entièrement payées, rattachées au mois par leur **date d'encaissement** Stripe (`status_transitions.paid_at`), séparé en abonnement et dépassements selon les mêmes motifs que la santé SaaS |
| Local HT | Indicateur de la santé SaaS, rattaché au mois par l'**échéance** (`dueAt`) |
| Remboursé | TTC remboursé sur les factures encaissées dans le mois ; HT par ventilation proportionnelle au HT de chaque facture, **provisoire**, sans validation comptable |
| Écarts | Par facture : absente du journal (`MISSING_LOCALLY`), inconnue du fournisseur (`UNKNOWN_AT_PROVIDER`), statut, montants (HT, TVA, TTC, payé) ou remboursement différents |

`reconciled` n'est vrai que sans aucun écart et si tous les comptes ont pu être lus. Une facture payée sans date d'encaissement est comptée à part et n'entre pas dans le revenu. C'est le cas des factures relues avant cette version tant qu'un rapprochement ne les a pas mises à jour. Les deux bases de date peuvent légitimement donner des totaux mensuels différents, par exemple pour une facture échue le 30 septembre et encaissée le 1er octobre : seuls les écarts par facture signalent un journal faux.

Essai réel du 27 octobre 2026, compte Stripe de test et `annona-dev` : 5 comptes lus, 8 factures encaissées, 764,78 € HT des deux côtés, 10,00 € TTC remboursés (8,33 € HT), aucun écart. Tests : `tests/saas02-reconciliation.test.ts`. Même jour, santé SaaS sur les mêmes données : 764,78 € HT bruts, 8,33 € HT remboursés, 756,45 € HT nets, identiques au rapprochement. Restent hors de cette tranche : la date comptable des remboursements, la rétention, la conversion, les coûts et les marges. Recette navigateur de `/admin` le même jour (`tests/e2e/saas02-admin.spec.ts`, super-admin temporaire créé par `npm run e2e:role-accounts -- setup` puis supprimé) : la section santé affiche les montants de l'API, remboursé et net compris, sans bouton ni champ, et un dispatcher reçoit 403 sur l'API.
