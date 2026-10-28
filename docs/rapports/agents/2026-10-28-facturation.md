# Rapport agent Facturation — DEMO-3, tranches 1 et 2 (28 octobre 2026)

Branche `agent/facturation`, base `integration/2026-10-28`. Périmètre validé : tranche 1 (paiements côté entreprise) et tranche 2 (facture créée à la livraison). Rien n'a été poussé ni déployé. La migration n'est pas appliquée.

## Ce qui est livré

### Tranche 1 — Paiements côté entreprise
- **Onglet « Paiements »** : premier onglet, ouvert par défaut, de Facturation (`/settings/billing`). Il contient trois compteurs cliquables (Payées / En attente / En retard), un filtre (Toutes, En attente, En retard, Payées) et la liste des 100 factures les plus récentes. Chaque ligne affiche la référence, le statut (« En retard · 12 j », comme la démo), le client, la commande (lien), l'échéance ou la date de paiement, le montant, la dernière relance avec son résultat, et le bouton « Relancer ». L'écran gère les états chargement, vide (par filtre) et erreur (avec « Réessayer »). Les cibles tactiles font au moins 44 px. Les réglages existants restent dans les onglets Courses et Factures.
- **Passage automatique en `OVERDUE`** (`src/domains/invoice/invoice-overdue.service.ts`). Il s'agit d'une seule mise à jour conditionnelle : `status = PENDING` et `dueDate` antérieure au minuit de Paris du jour. Une facture payée, annulée, en brouillon ou sans échéance n'est jamais touchée. Si un paiement est validé pendant le passage, PostgreSQL réévalue la condition sur la ligne verrouillée et le paiement gagne. Le passage est idempotent.
  - **Choix du mécanisme** : le passage est une tâche du filet cron existant `/api/cron/operations` (toutes les 5 min, même secret). Il est aussi lancé, limité à l'entreprise, à chaque consultation de la liste.
    - Raison : aucun nouveau planificateur, et la liste reste juste même si le cron est arrêté (cas de tutelliv-dev).
    - Un échec du passage est signalé (incident `invoice-overdue-sweep-failure`, réponse 503) sans bloquer les tâches durables.
    - Option écartée : un statut seulement calculé à la lecture. Le PDF, le Factur-X, l'export comptable et le portail lisent tous le statut stocké.
- **Facture en retard toujours payable** : `markOrderInvoicePaid` accepte PENDING et OVERDUE, avec la même réclamation sur `updatedAt`. Une facture en retard réémise à la main est mise à jour au lieu d'être doublée. Ce doublon était un vrai défaut, révélé par le test rouge. La fiche commande affiche une facture en retard comme émise.
- **« Relancer »** (`POST /api/invoices/[id]/reminders`, `src/domains/invoice/invoice-reminder.service.ts`) :
  - **Trace** : chaque relance est enregistrée dans la table `invoice_reminders` (qui `sentById`, quand `createdAt`, canal `EMAIL`, résultat, `completedAt`).
  - **E-mail** : il part par une tâche durable `CLIENT_NOTIFICATION` (kind `INVOICE_REMINDER`), seulement si `getEmailDeliveryConfigured()` est vrai (infrastructure de `notify.service.ts`). Sinon, la relance est tracée `NOT_SENT_EMAIL_NOT_CONFIGURED`, avec un code 200 et sans erreur. Autres résultats possibles : client sans adresse (`NOT_SENT_NO_RECIPIENT`), préférences du client coupées (`NOT_SENT_CLIENT_PREFERENCES`, même règle que l'e-mail « Nouvelle facture »), facture réglée entre le clic et l'envoi (`NOT_SENT_INVOICE_SETTLED`), échec définitif de l'envoi (affiché « Échec d'envoi », et la facture peut être relancée).
  - **Anti-doublon de 24 heures** : la facture est verrouillée (`FOR UPDATE`). Un second clic dans le délai rejoue la relance existante (`duplicate: true`) sans nouvel envoi. Un rejeu de la tâche n'envoie rien si la relance n'est plus `QUEUED`, et la clé d'idempotence Resend reprend la clé de la tâche. Une tentative non envoyée identique n'est tracée qu'une fois par jour.
  - **Permissions** : mêmes droits que la facturation existante, `invoices:update` + `requireRole([COMPANY_ADMIN, MINI_ADMIN])`. La liste exige `invoices:read`.
  - **Contenu de l'e-mail** : texte brut. Le sujet est « Rappel : facture {réf} ». Le corps donne le montant, l'échéance, les jours de retard et le lien portail. Référence et nom d'entreprise sont mis sur une ligne, puis l'en-tête est nettoyé par le transport.

### Tranche 2 — Facture créée à la livraison
- **Réglage par entreprise** : `settings.billing.invoice.autoInvoiceOnDelivery`, **désactivé par défaut**. Il s'active par un interrupteur dans Facturation › Factures. Aucune migration n'est nécessaire : il est écrit par `updateCompanyBillingSettings`, qui passe par `updateSettingsWithClaim`.
- **Modèle respecté** : une facture par commande, comme `createOrderInvoice`. Les valeurs par défaut sont celles du formulaire manuel : zone suggérée par le code postal, achats validés par le livreur, TVA et délai de paiement de l'entreprise. L'e-mail « Nouvelle facture » existant est réutilisé (`queueInvoiceIssuedNotification`).
- **Les trois passages en « Livrée »** inscrivent une tâche durable dans leur propre transaction, avec la clé unique `delivery-invoice:{orderId}` :
  - le livreur (`updateDeliveryStatusByDriver`) ;
  - l'admin depuis la livraison (`adminUpdateDelivery`) ;
  - l'admin depuis la commande (`updateCompanyOrderStatus`).

  Le réglage est lu dans la transaction : désactivé, rien n'est inscrit. La facture est émise **hors de la transition**, par la tâche lancée avec `after()` et reprise par le cron.
- **Idempotence stricte** :
  - la clé de tâche est unique par commande ;
  - à l'exécution, on vérifie que la commande est livrée, qu'elle n'a aucune facture et que le réglage est toujours actif ;
  - ces conditions sont revérifiées sous `FOR UPDATE` sur la commande ;
  - une facture manuelle existante n'est jamais doublée ni modifiée.
- **Erreur visible** : sans zone ni achat, l'erreur explicite `DELIVERY_INVOICE_EMPTY` apparaît sur la tâche (`lastError`). La tâche est rejouée, puis passe FAILED, ce qui est visible dans la santé des traitements et dans l'incident cron. L'administrateur peut alors facturer à la main ; une relance ultérieure de la tâche se termine en « facture existante ».

### Fichiers partagés touchés (minimalement)
- `prisma/schema.prisma` : modèle `InvoiceReminder` et 4 relations inverses.
- `delivery.service.ts` : 2 blocs de 4 lignes.
- `order.service.ts` : 1 bloc.
- `operation-job.service.ts` : 2 branches `kind`.
- `cron/operations/route.ts`.
- Inventaires : `docs/operations/admin01/tenant-api-boundaries.md` (+2 routes), `tests/admin01-tenant-api-boundary-inventory.test.ts` (58→60 méthodes, 40→42 fichiers), `docs/operations/data02/INVENTORY.md` (+`InvoiceReminder`, export « non »).
- Dépendances simulées ajoutées dans `tests/operations-health.test.ts`, `tests/billing-separation.test.ts` et `tests/order-atomicity.test.ts`.

`notify.service.ts`, le portail client, `status-badges.tsx`, le thème, `order-intake` et le dispatch n'ont **pas** été modifiés.

## Migration (à relire et appliquer par l'orchestrateur sur tutelliv-dev)
`prisma/migrations/20261028230000_invoice_reminders/migration.sql` est additive. Elle est identique au `prisma migrate diff` du schéma, plus la RLS et le REVOKE exigés par `tests/db1-migration-security.test.ts`.

## Checklist de preuves

**Skills invoqués** :
- `tutelliv-model-router` ;
- `superpowers:test-driven-development` ;
- `karpathy-guidelines` ;
- `web-design-guidelines` : revue de l'écran, avec deux corrections (nom accessible cohérent avec le libellé visible « Relancée », `touch-manipulation`) ;
- `superpowers:verification-before-completion`.

Sous-agents :
- `explorateur` (Haiku) : cartographie des passages en Livrée ;
- `general-purpose` (Sonnet) : revue de sécurité ;
- `verificateur` (Sonnet) : `npm run check`.

**Test rouge puis vert, par point**

| Point | Test (fichier) | Rouge observé | Vert | Commit |
|---|---|---|---|---|
| Échéance Paris, jours de retard, passage OVERDUE conditionnel et idempotent | `tests/demo3-invoice-overdue.test.ts` | module absent (`Cannot find module invoice-due`) | 8/8 | ec0b957 |
| Facture OVERDUE payable | idem, « reste payable » | `INVOICE_NOT_PAYABLE` (prouvé en remettant l'ancien code par `git stash`) | vert | ec0b957 |
| Passage en retard dans le cron, échec signalé sans bloquer | `tests/demo3-cron-overdue.test.ts` | 2 échecs (`expected 1, actual 0` ; `expected 503, actual 200`) | 3/3 et 14/14 avec operations-health | d80c3b0 |
| Table de trace | `db1-migration-security`, `data02-inventory` | inventaire DATA-02 rouge (modèle non classé) | 17/17 | 7f435a0 |
| Relance : trace, file, anti-doublon, concurrence, sans e-mail, sans destinataire, statut, autre entreprise, envoi, rejeu, préférences, injection | `tests/demo3-invoice-reminder.test.ts` | module absent | 19/19, puis 20/20 | 886951a, b73f868 |
| Trace « non envoyée » dédoublonnée, vue sans `sentById` | idem, « clics répétés » | `expected true, actual false` | vert | b73f868 |
| Routage des tâches (relance, facture livraison, échec visible) | `tests/demo3-operation-job-routing.test.ts` | 2 échecs (aucun appel) | 2/2 | 9d88cbf |
| Liste : isolation, compteurs, filtres, retard, dernière relance, `canRemind` | `tests/demo3-company-invoices.test.ts` | module absent | 4/4 | ade1dfd |
| Routes : droits, 400, 404, 409, auteur et état de l'e-mail transmis | `tests/demo3-invoice-routes.test.ts` + inventaire ADMIN-1 | ENOENT, puis inventaire 58≠60 | 5/5 et inventaire vert | d753506 |
| Réglage désactivé par défaut, file par commande, génération, rejeu et course, facture manuelle, réglage coupé, échec de livraison, autre entreprise, sans zone, client sans compte | `tests/demo3-delivery-invoice.test.ts` | module absent | 11/11 | 9d88cbf |
| Réémission d'une facture OVERDUE sans doublon | idem | `expected 'late', actual 'inv_1'` (doublon réel) | vert | 9d88cbf |
| Livrée par le livreur, par l'admin livraison (deux fois), par l'admin commande | idem | 3 échecs (`expected 1, actual 0`) | vert | 9d88cbf |
| Libellés écran (« En retard · 12 j », résultats, messages) | `tests/demo3-payments-labels.test.ts` | module absent | 4/4 | 445650b |
| Factur-X et PDF classique d'une facture OVERDUE | `tests/facturx-mapping.test.ts` (dernier test) | non-régression : rouge prouvé par mutation (OVERDUE refusé dans `facturx-availability`), puis code restauré | 18/18 | f2cdcd5 |

**États voisins couverts** :
- facture payée la veille de l'échéance ;
- facture payée pendant le passage en retard ;
- facture annulée ou en brouillon (ni retard, ni paiement, ni relance) ;
- échéance absente, échéance aujourd'hui, échéance future ;
- relance double, relance simultanée, relance après 24 h, relance après un échec d'envoi ;
- relance sans e-mail configuré (et reprise une fois configuré) ;
- client sans e-mail, supprimé ou d'une autre entreprise ;
- relance par un rôle sans droit : DISPATCHER, SUPER_ADMIN, CLIENT, DRIVER ;
- facture d'une autre entreprise (404) ;
- facture réglée entre le clic et l'envoi ;
- préférences client coupées ;
- panne du fournisseur d'e-mail (rejeu) ;
- injection CR/LF dans le sujet ;
- livraison passée deux fois en Livrée, course entre deux générations, rejeu de la tâche ;
- livraison échouée ;
- réglage désactivé, et réglage coupé entre la livraison et le traitement ;
- facture manuelle préexistante ;
- client sans compte ;
- Factur-X d'une facture en retard.

**`npm run check` final** : lancé par `lourd.sh` après le dernier commit de code **b73f868**, code de sortie 0 :
- `tsc` sans erreur ;
- `eslint src --max-warnings=0` sans erreur ni avertissement ;
- **997/997 tests**, 0 échec (la base comptait 934 tests).

Les fichiers de test, hors du périmètre lint de `check`, sont passés à part avec `eslint --max-warnings=0` : propre.

**SHA (du plus ancien au plus récent)** : ec0b957, d80c3b0, 7f435a0, 886951a, ade1dfd, d753506, 9d88cbf, 445650b, f2cdcd5, 3135d7b, b73f868, puis le commit de ce rapport.

**`git diff --stat integration/2026-10-28...HEAD | tail -1`** avant le commit du rapport : `39 files changed, 2545 insertions(+), 26 deletions(-)`. Le rapport ajoute un fichier.

**Ce qui n'est PAS vérifié** :
- aucun clic réel en navigateur (interdit à cet agent) ;
- la spec `tests/e2e/demo3-payments.spec.ts` est écrite mais **non lancée** ;
- la migration n'est pas appliquée et n'a pas été jouée sur une base réelle ;
- aucun envoi d'e-mail réel ;
- le comportement PostgreSQL sous concurrence réelle (verrou `FOR UPDATE`, réévaluation de `UPDATE … WHERE status='PENDING'`) est simulé par des fakes qui sérialisent les transactions, sans base réelle ;
- `npm run build` n'a pas été lancé ;
- le rendu Dark n'a pas été vu ;
- la croissance du volume au-delà de 100 factures n'a pas été mesurée (pas de pagination : un message renvoie vers les filtres et l'export comptable).

**Auto-relecture** : le diff complet a été relu. Points notés et acceptés :
- (a) Le passage en retard modifie `updatedAt`. Un administrateur qui marque payée une facture affichée avant le passage reçoit le 409 existant « Rechargez-la ». Ce comportement est voulu : c'est la réclamation optimiste existante.
- (b) La lecture de la liste écrit en base avec `invoices:read` (passage limité à l'entreprise, idempotent).
- (c) Une entreprise qui active la facture à la livraison sans zone tarifaire verra des tâches FAILED (`DELIVERY_INVOICE_EMPTY`). C'est voulu (« jamais silencieuse »), à expliquer à l'activation.
- (d) La réémission manuelle d'une facture OVERDUE la repasse en PENDING avec une nouvelle échéance, sans trace dédiée. C'est la sémantique existante de la réémission.
- (e) L'état du filtre n'est pas reflété dans l'URL : même limite que les onglets existants.

**Revue de sécurité** (sous-agent Sonnet, lecture seule) : **aucun problème critique**.
- Isolation entre entreprises, permissions, idempotence, `$queryRaw` paramétré, charges utiles sans données personnelles, migration avec RLS et REVOKE : conformes.
- Corrigé dans b73f868 :
  - tentatives non envoyées sans plafond (désormais une trace par jour et par résultat) ;
  - `sentById` exposé par la route (retiré) ;
  - `error.message` Prisma dans l'incident cron (message fixe).
- Accepté : e-mail envoyé avant la mise à jour du résultat. En cas de mort du processus entre les deux, le rejeu renvoie le même e-mail, dédoublonné par la clé d'idempotence Resend. L'identifiant de la route n'est pas validé en format (requêtes paramétrées, 404 générique).

**Délais choisis** :
- retard à partir du lendemain du jour d'échéance, heure de Paris ;
- anti-doublon de relance : **24 heures** (`INVOICE_REMINDER_COOLDOWN_HOURS`) ;
- passage en retard toutes les 5 minutes (filet cron) et à chaque consultation ;
- tâches : 3 tentatives (reprises à 1, 5 puis 30 minutes, réglage existant) ;
- liste plafonnée à 100 factures.

**Proposition de texte pour l'entrée DEMO-3 de `TODO.md`** (à reporter par l'orchestrateur) :

> Tranches 1 et 2 livrées sur `agent/facturation` (28/10/2026), en attente de recette navigateur et d'application de la migration `20261028230000_invoice_reminders` sur tutelliv-dev. (1) Facturation › Paiements : compteurs payées / en attente / en retard, filtres, jours de retard. Passage automatique en OVERDUE (filet cron et consultation, conditionnel et idempotent). « Relancer » tracé (auteur, date, canal, résultat), anti-doublon de 24 h, e-mail par tâche durable seulement si l'envoi est configuré, sinon trace « non envoyée ». (2) Facture émise à la livraison : réglage par entreprise désactivé par défaut, tâche durable à clé unique par commande, une seule facture par commande, e-mail « Nouvelle facture » réutilisé. `npm run check` 997/997 après b73f868. Reste : clic réel en navigateur, spec `tests/e2e/demo3-payments.spec.ts` à lancer, e-mails réels liés à EMAIL ; tranches 3 à 10 non commencées.
