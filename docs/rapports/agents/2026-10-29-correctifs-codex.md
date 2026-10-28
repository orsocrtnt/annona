# Correctifs Codex (I1, I2, C1 à C4) — 2026-10-29

Branche `agent/correctifs-codex`, base fcc0a5c. Aucune migration, aucune écriture hors du worktree.

## I1 — commande IA : anti-doublon atomique
- `createClientOrder` accepte `request.beforeCreate(tx)`, exécutée au début de chacune de ses deux transactions (`src/domains/order/order.service.ts`). Le géocodage reste avant la transaction.
- `createOrderFromIntake` y prend `pg_advisory_xact_lock(hashtextextended(companyId::text || ':' || key::text, 0))` (SQL paramétré) puis relit `(companyId, key)` ; un autre client déjà titulaire → `IDEMPOTENCY_KEY_REUSED` → 409. Même client : rejeu, même commande (contrainte `(customerId, key)` inchangée). Le contrôle rapide hors transaction est conservé.

## I2 — livreur visible par le client
Règle : prénom toujours, téléphone si `Company.settings.portalShowDriverPhone` (défaut true), jamais le nom de famille ; masquage dans la requête et le DTO.
- Réglage : `src/domains/company/portal-settings.service.ts` (`updateSettingsWithClaim`), route `GET/PATCH /api/company/portal-settings` (COMPANY_ADMIN, MINI_ADMIN ; `settings:read/update`), interrupteur « Afficher le téléphone du livreur aux clients » dans `src/app/(back-office)/settings/page.tsx` (ligne min-h-11 = 44 px, désactivée en lecture seule SaaS).
- Règles communes : `src/domains/delivery/client-driver.ts`.

## C2 — le nom complet du livreur sortait encore vers le client (e31f704, 8b57200)
- `GET /api/portal/orders/[id]` : `getClientOrderById` chargeait toutes les colonnes des livraisons, dont `driverName`, avec la chronologie. Désormais, chaque livraison sort :
  - sans `driverName` ;
  - avec `driver` limité au prénom, et au téléphone selon `portalShowDriverPhone` (select Prisma restreint) ;
  - avec une chronologie nettoyée.
- `redactClientTimeline(events, driverNames)` réduit au prénom le nom complet connu de la livraison (`driverName` stocké), avec ou sans le préfixe « Livreur », sans tenir compte de la casse et sur des mots entiers. Un nom de famille seul n'est pas touché : une adresse « rue Benali-Martin » reste intacte. Cette fonction sert à :
  - la fiche commande ;
  - la fiche livraison ;
  - le suivi partagé ;
  - la carte client (`trackingSteps[].description`, seulement quand `driverFirstNameOnly`).
- Échanges de commande (`GET /api/order-conversations/[id]`), trouvés pendant l'inventaire : un message écrit par un livreur portait `authorName` = « Prénom Nom ». Pour un acteur CLIENT, l'auteur LIVREUR est réduit au prénom (`clientAuthorName`).
- Source contre lecture : les événements de suivi et les messages sont **partagés** avec le back-office, qui doit garder le nom complet. Les réécrire à la source changerait les vues admin et dispatcher. Le nettoyage se fait donc en lecture, pour les événements nouveaux comme pour ceux déjà en base. Les seules écritures destinées au seul client (notifications, e-mails) ont été vérifiées à la source : leurs textes sont génériques, sans nom.
- Back-office inchangé, vérifié par un test : suivi, échanges et carte de dispatch (`getDispatchMapDeliveries`) gardent « Karim Benali ».

## C1 — deux relances simultanées pour une même facture (2fcbfc3)
Réservation d'envoi par facture sous `pg_advisory_xact_lock(hashtextextended('invoice-reminder:' || invoiceId, 0))` :
- QUEUED → SENDING sous le verrou ;
- l'e-mail part hors transaction, puis la relance passe SENT ;
- une autre relance SENDING, ou SENT dans les 24 h, donne `SKIPPED_SUPERSEDED` ;
- une réservation orpheline expire au bout de 5 min (bail des tâches), puis est reprise avec la même clé fournisseur ;
- le bouton refuse tant qu'une relance est SENDING.

Le détail figure dans `docs/rapports/agents/2026-10-28-facturation.md`, section C1.

## C3 — nom d'un ancien livreur dans l'historique client (5ea0067)
Scénario Codex : un événement « Assignée automatiquement » porte « Livraison confiée à Livreur Jean de La Fontaine — choix automatique ». Le livreur a ensuite été réaffecté à Karim Benali. Deux causes : ce libellé manquait à la liste, et seul le livreur courant était transmis au filtre, dont le motif ignorait les particules en minuscules.

Correction dans `src/domains/delivery/client-driver.ts` :
1. **Tous les livreurs de l'entreprise** sont masqués côté client. `loadCompanyDriverNames` lit une seule fois par réponse les livreurs de l'entreprise : rôle DRIVER, `companyId` de l'appelant, inactifs compris (aucun filtre `status`), en ne sélectionnant que le prénom et le nom. Chaque nom complet est remplacé par le prénom de la fiche. La correspondance porte sur des mots entiers, traits d'union compris, sans tenir compte de la casse, en commençant par les noms les plus longs. Ce chargement sert à la fiche commande (`order.service.ts`), la fiche livraison (`delivery.service.ts`), la carte (`dispatch-map.service.ts`, option `clientDriverNames`) et le suivi partagé (`tracking.service.ts`, dans la transaction).
2. **Filet de sécurité « Livreur <Nom…> »**, utile pour un livreur supprimé dont le nom n'est plus en fiche. Il retient le prénom (majuscule initiale), puis les mots du nom, particules courtes en minuscules comprises : de, du, de la, van der, d'Arc… Il s'arrête à la ponctuation, à une flèche, à un tiret ou à un mot ordinaire, et ne garde que le premier mot.
   - Écart assumé avec la consigne « jusqu'à la ponctuation » : on s'arrête aussi au premier mot ordinaire (plus de 3 lettres, en minuscules). Ainsi « Livreur Karim a confirmé… » garde sa phrase.
3. **Libellé « Assignée automatiquement »** ajouté. Les autres libellés d'affectation trouvés dans `delivery.service.ts` (« Réassignation forcée », « Assignation forcée », « Chauffeur réassigné », « Assignée au chauffeur », « Chauffeur retiré ») y figuraient déjà. `auto-dispatch.service.ts` n'écrit pas d'événement propre : il passe par `assignDeliveryToDriver` (`automatic: true`).

## C4 — double relance après une issue d'envoi ambiguë (56273d2)
Scénario Codex : R1 est acceptée par le fournisseur, mais la réponse se perd (`fetch` expire). Le catch rendait R1 QUEUED ; un clic créait alors R2, envoyée avec une autre clé, d'où deux e-mails.
- `emailSendOutcome(error)` (`src/lib/email/transactional-email.ts`) distingue deux cas :
  - `"rejected"` : réponse HTTP explicite du fournisseur, 4xx ou 5xx. L'erreur porte `providerRejected` et le message `EMAIL_PROVIDER_HTTP_<code>`.
  - `"unknown"` : tout le reste (expiration, erreur réseau, réponse illisible, erreur non qualifiée).
- Issue inconnue : la relance reste `SENDING`, sans aucune libération. La reprise se fait avec la même clé fournisseur, après expiration (5 min) ou par le rejeu de la tâche. D'ici là, le rejeu échoue en `INVOICE_REMINDER_SEND_IN_PROGRESS`, et « Relancer » refuse avec « Une relance est en cours d'envoi ».
- Seul un refus certain rend la réservation (`QUEUED`).
- L'en-tête `Idempotency-Key` était déjà envoyé à Resend, et des tests existants le vérifient (`tests/transactional-email.test.ts:79,139`).

## Checklist de preuves
### Rouge puis vert
| Point | Rouge | Vert | États voisins (verts avant et après) |
|---|---|---|---|
| I1 deux clients, même clé, simultané | `order-intake-atomic` test 1 : 2 commandes | 1 création + 1 conflit | rejeu même client, séquentiel autre client |
| I1 géocodage hors transaction | test 4 rouge (garde absente) | vert | contrôle STATIQUE de la source, pas un test fonctionnel |
| I2 fiche livraison défaut / masqué | `portal-driver-delivery` 1, 2 : nom complet + `driverName` | prénom + téléphone / prénom seul, select sans `phone` ni `lastName` | autre entreprise → null ; sans livreur → null |
| I2 assistance | test 5 : « Livreur Karim Benali » | « Karim », téléphone selon réglage | |
| I2 carte portail | test 6 rouge (flag désactivé) | « Livreur Karim » | |
| I2 réglage | modules absents | `portal-driver-setting` 7/7 | PATCH garde dispatch/proofRules/billing/deliveryCategories ; réclamation `updatedAt` ; rôles CLIENT/DRIVER/DISPATCHER/SUPER_ADMIN refusés avant lecture/écriture ; corps invalide 400 |
| C2 sorties client (livreur « Karim Benali », événements le citant, ancien livreur « Awa Diallo ») | `portal-outputs-no-surname` 1, 2 : `portal/orders/[id] expose le nom de famille` ; test 4 : `KARIM BENALI est en route` non réduit | aucune sortie ne contient « Benali » ni « Diallo » : commande, fiche livraison, carte, assistance, suivi partagé, échanges ; téléphone selon le réglage ; `driverName` absent ; carte « Karim a confirmé… » ; auteur « Karim » | test 3 back-office (nom complet gardé) vert avant et après ; adresse « rue Benali-Martin » intacte |
| C1 entrelacement exact R1 / R2 | `c1-invoice-reminder-reservation` 2 : **2 e-mails au lieu de 1** | 1 e-mail, clic refusé (`duplicate`, SENDING), aucune R2 | entrelacement inverse (seule R2 part) et panne fournisseur (QUEUED puis rejeu) verts avant et après |
| C1 orpheline / réservation valide / autre relance / facture payée / bouton | tests 1, 4 à 8 rouges (constante absente, R2 créée, orpheline ignorée, envoi malgré SENDING, réservation non vérifiée) | verts | `demo3-invoice-reminder` 23/23 inchangé |
| C3 anciens livreurs (particule « Jean de La Fontaine » inactif, « MARIE-CLAIRE DUPONT-MARTIN » en majuscules et à trait d'union, « le livreur jean de la fontaine » en minuscules) | `portal-outputs-no-surname` 1, 2 : `portal/orders/[id] expose « Fontaine »` ; test 5 : description intacte (reproduction Codex) ; test 6 : filet sans particules | aucune sortie client ne contient Fontaine, Dupont ni Martin ; « le livreur Jean passe le colis à Marie-Claire » ; requête des livreurs limitée à l'entreprise, sans filtre `status` ; 6 cas de filet verts | test back-office (nom complet) vert avant et après |
| C4 réponse perdue puis clic | `c1-invoice-reminder-reservation` 10 : `expected 'SENDING', actual 'QUEUED'` ; `transactional-email` 7 : `emailSendOutcome` absent | R1 reste SENDING, clic refusé (`duplicate`, SENDING), aucune R2, rejeu avant expiration sans envoi | reprise après expiration (même clé, SENT) et refus 422 (QUEUED, nouvelle relance possible) verts avant et après |
| C1 écran | `demo3-payments-labels` 6 : libellé « Relance tracée » | « Relance en cours d'envoi » + message de refus | 5 tests existants verts |

Adaptés (effets de bord attendus) :
- `tenant-boundaries` : lecture du réglage stubbée ;
- `tracking` : doublure du module ;
- inventaire `admin01-tenant-api-boundary-inventory` : 66 routes et 46 fichiers, plus `docs/operations/admin01/tenant-api-boundaries.md` ;
- C2 : `order-conversation` et `order-atomicity` déclarent les nouvelles dépendances de leurs modules chargés en isolation.
- C3 : `tracking`, `tenant-boundaries` et `portal-driver-delivery` simulent la lecture des noms de livreurs (`user.findMany`).

### Check final
`lourd.sh npm run check` après le dernier commit de code (**56273d2**) : exit 0, tsc et `eslint src` propres, **1145 tests, 1145 passés, 0 échec**. Historique : 1139 après b08578a (C1/C2, fusionné en 013d1fc), 1125 après 35f9a62 (I1/I2), 1108 à la base.

### SHA
Du plus ancien au plus récent :
- bd9f426 (I1) ;
- 195b320 (socle I2) ;
- 5aba3ef (câblage I2) ;
- 35f9a62 (inventaire et doublures) ;
- 8db1cbb (rapport I1/I2) ;
- e31f704 (C2) ;
- 2fcbfc3 (C1) ;
- 8b57200 (doublures C2) ;
- 3a046cd (rapports C1/C2) ;
- b08578a (C1 : rejeu sans verrou) ;
- 1ae425b (rapport) ;
- 5ea0067 (C3) ;
- 56273d2 (C4).

Le commit de cette mise à jour du rapport suit.

### Diff
`git diff --stat fcc0a5c...HEAD | tail -1` après 56273d2 : `34 files changed, 1471 insertions(+), 108 deletions(-)`. Depuis la fusion 013d1fc, C3 et C4 représentent `13 files changed, 247 insertions(+), 35 deletions(-)`.

### Non vérifié
- Aucun clic navigateur (interdit) : interrupteur, tap 44 px, page livraison portail à recetter.
- Verrou `pg_advisory_xact_lock` simulé en mémoire, pas exécuté sur PostgreSQL réel (le SQL est paramétré ; `::text` pour typer les paramètres).
- Noms de livreurs cités dans du texte libre saisi par le personnel (motif d'annulation, etc.) : seuls les formats connus sont expurgés.
- Prénom dérivé du nom stocké (carte, suivi partagé) = premier mot : un prénom composé séparé par un espace est tronqué (sens le plus sûr).
- Historique : les anciens événements de suivi restent en base avec les noms ; l'expurgation se fait à la lecture.
- C3 : un livreur **supprimé** (absent des fiches) cité sans le préfixe « Livreur » n'est pas réduit. Avec ce préfixe, le filet le couvre. Un nom de famille cité seul, sans prénom, n'est pas reconnu : « Benali » seul resterait.
- C3 : le filet s'arrête au premier mot ordinaire. Un nom composé seulement de mots en minuscules après le prénom n'est pas réduit, sauf s'il est connu en fiche.
- C2 : les stubs Prisma du test commun simulent les requêtes ; aucune sortie n'a été lue sur une base réelle.
- C2 : les écrans client n'ont pas été vus : fiche commande, carte, échanges.
- C1 : le verrou consultatif et la réservation SENDING sont simulés par une base en mémoire qui sérialise les transactions, sans PostgreSQL réel. La reprise d'une orpheline n'a pas été exercée avec un vrai crash ni avec un envoi Resend réel (déduplication par clé non observée).
- C4 : expiration et erreur réseau simulées par des erreurs injectées. Aucun envoi Resend réel : la déduplication par `Idempotency-Key` côté fournisseur n'a pas été observée.
- `npm run build` non lancé.

### Inventaire des sorties client contenant des données de livreur
| Sortie | Fichier:ligne | Traitement |
|---|---|---|
| `GET /api/portal/orders/[id]` (fiche commande) | `src/domains/order/order.service.ts:382,393,404-405` (route `src/app/api/portal/orders/[id]/route.ts:28-29`) | C2 : select prénom (+téléphone si réglage), `driverName` retiré, chronologie réduite au prénom ; C3 : tous les livreurs de l'entreprise |
| `GET /api/portal/{orders,deliveries}/[id]/reorder` | `src/domains/order/order.service.ts:407-454` | passe par `getClientOrderById` ; ne renvoie que le formulaire : aucune donnée de livreur |
| `GET /api/portal/deliveries/[id]` (fiche) | `src/domains/delivery/delivery.service.ts:192,219,228-229` (route `src/app/api/portal/deliveries/[id]/route.ts`) | select prénom (+téléphone si réglage), `driverName` retiré, chronologie réduite au prénom (C2 : nom complet connu) |
| Page fiche livraison portail | `src/app/(client-portal)/portal/deliveries/[id]/page.tsx:~123` | prénom, téléphone seulement s'il est présent |
| `GET /api/portal/support/contacts` | `src/domains/client-portal/support-contacts.service.ts:72-73` | prénom, téléphone selon réglage, `delivery` réduit (plus de `driverName`) |
| `GET /api/portal/deliveries/map` | `src/domains/delivery/dispatch-map.service.ts:150,639-641,768` (appel `:772-773`) | « Livreur Prénom » ; C2/C3 : `trackingSteps[].description` réduites au prénom, tous les livreurs de l'entreprise |
| `GET /api/tracking/[id]` (acteur CLIENT, suivi partagé) | `src/domains/tracking/tracking.service.ts:28,33,35` | « Livreur Prénom », chronologie réduite au prénom (C2), tous les livreurs de l'entreprise (C3) |
| `GET /api/order-conversations/[id]` (acteur CLIENT) | `src/domains/order-conversation/order-conversation.service.ts:66` | C2 : auteur livreur réduit au prénom |
| Alertes opérationnelles (`/api/operational-alerts`) | `src/domains/operational-alerts/operational-alerts.service.ts:13` | n'exposent que l'auteur de la prise en compte ou de la résolution, réservées au personnel (`canActOnOperationalAlerts`) : inchangé |
| Événements de suivi (affectation, retrait, refus, annulation) | règles `src/domains/delivery/client-driver.ts` | descriptions de ces libellés vidées ; « Livreur Prénom Nom » → « Livreur Prénom » ; nom complet connu → prénom |
| Notifications / e-mails client | `src/domains/client-portal/notify.service.ts:65,72-73,169-194` ; messages : `order-conversation.service.ts:120` | aucun nom ni téléphone (textes génériques, charge utile sans description) : inchangé |
| Liste des commandes portail et export CSV | `src/domains/order/order.service.ts:201-213` (`CLIENT_ORDER_HISTORY_SELECT`), `:305-320` | livraisons limitées à id, référence et statut ; l'export ne contient pas de livreur : inchangé |
| PDF de preuve | `src/domains/delivery/proof.service.ts:72-79` | ne transmet pas `driverName` au PDF (`proof-pdf.ts:162` reste inutilisé) : inchangé |
| Listes portail (`getClientDeliveries`, dashboard) | `delivery.service.ts:70-92` | ne sélectionnent aucune donnée de livreur : inchangé |
| Page de suivi publique | aucune (pas de route hors session client) | n/a |
