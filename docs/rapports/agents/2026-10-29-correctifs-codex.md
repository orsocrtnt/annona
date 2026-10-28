# Correctifs Codex (I1, I2, C1, C2) — 2026-10-29

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
| C1 écran | `demo3-payments-labels` 6 : libellé « Relance tracée » | « Relance en cours d'envoi » + message de refus | 5 tests existants verts |

Adaptés (effets de bord attendus) :
- `tenant-boundaries` : lecture du réglage stubbée ;
- `tracking` : doublure du module ;
- inventaire `admin01-tenant-api-boundary-inventory` : 66 routes et 46 fichiers, plus `docs/operations/admin01/tenant-api-boundaries.md` ;
- C2 : `order-conversation` et `order-atomicity` déclarent les nouvelles dépendances de leurs modules chargés en isolation.

### Check final
`lourd.sh npm run check` après le dernier commit de code (**8b57200**) : exit 0, tsc et `eslint src` propres, **1139 tests, 1139 passés, 0 échec** (I1/I2 : 1125 après 35f9a62 ; base : 1108).

### SHA
Du plus ancien au plus récent :
- bd9f426 (I1) ;
- 195b320 (socle I2) ;
- 5aba3ef (câblage I2) ;
- 35f9a62 (inventaire et doublures) ;
- 8db1cbb (rapport I1/I2) ;
- e31f704 (C2) ;
- 2fcbfc3 (C1) ;
- 8b57200 (doublures C2).

Le commit de cette mise à jour du rapport suit.

### Diff
`git diff --stat fcc0a5c...HEAD | tail -1` avant le commit du rapport : `31 files changed, 1165 insertions(+), 99 deletions(-)`. La valeur après ce commit figure dans le message final.

### Non vérifié
- Aucun clic navigateur (interdit) : interrupteur, tap 44 px, page livraison portail à recetter.
- Verrou `pg_advisory_xact_lock` simulé en mémoire, pas exécuté sur PostgreSQL réel (le SQL est paramétré ; `::text` pour typer les paramètres).
- Noms de livreurs cités dans du texte libre saisi par le personnel (motif d'annulation, etc.) : seuls les formats connus sont expurgés.
- Prénom dérivé du nom stocké (carte, suivi partagé) = premier mot : un prénom composé séparé par un espace est tronqué (sens le plus sûr).
- Historique : les anciens événements de suivi restent en base avec les noms ; l'expurgation se fait à la lecture.
- C2 : un événement qui cite le nom complet d'un **ancien** livreur, hors des libellés connus et sans le préfixe « Livreur », n'est pas réduit : seul le nom stocké de la livraison courante est connu. Les libellés d'affectation, de retrait et de refus sont vidés, et « Livreur Prénom Nom » est réduit partout.
- C2 : les stubs Prisma du test commun simulent les requêtes ; aucune sortie n'a été lue sur une base réelle.
- C2 : les écrans client n'ont pas été vus : fiche commande, carte, échanges.
- C1 : le verrou consultatif et la réservation SENDING sont simulés par une base en mémoire qui sérialise les transactions, sans PostgreSQL réel. La reprise d'une orpheline n'a pas été exercée avec un vrai crash ni avec un envoi Resend réel (déduplication par clé non observée).
- `npm run build` non lancé.

### Inventaire des sorties client contenant des données de livreur
| Sortie | Fichier:ligne | Traitement |
|---|---|---|
| `GET /api/portal/orders/[id]` (fiche commande) | `src/domains/order/order.service.ts:390,401-402` (route `src/app/api/portal/orders/[id]/route.ts:28-29`) | C2 : select prénom (+téléphone si réglage), `driverName` retiré, chronologie réduite au prénom |
| `GET /api/portal/{orders,deliveries}/[id]/reorder` | `src/domains/order/order.service.ts:407-454` | passe par `getClientOrderById` ; ne renvoie que le formulaire : aucune donnée de livreur |
| `GET /api/portal/deliveries/[id]` (fiche) | `src/domains/delivery/delivery.service.ts:216,225-226` (route `src/app/api/portal/deliveries/[id]/route.ts`) | select prénom (+téléphone si réglage), `driverName` retiré, chronologie réduite au prénom (C2 : nom complet connu) |
| Page fiche livraison portail | `src/app/(client-portal)/portal/deliveries/[id]/page.tsx:~123` | prénom, téléphone seulement s'il est présent |
| `GET /api/portal/support/contacts` | `src/domains/client-portal/support-contacts.service.ts:72-73` | prénom, téléphone selon réglage, `delivery` réduit (plus de `driverName`) |
| `GET /api/portal/deliveries/map` | `src/domains/delivery/dispatch-map.service.ts:150,639-641` (appel `:771-772`) | « Livreur Prénom » ; C2 : `trackingSteps[].description` réduites au prénom |
| `GET /api/tracking/[id]` (acteur CLIENT, suivi partagé) | `src/domains/tracking/tracking.service.ts:31,33` | « Livreur Prénom », chronologie réduite au prénom (C2) |
| `GET /api/order-conversations/[id]` (acteur CLIENT) | `src/domains/order-conversation/order-conversation.service.ts:66` | C2 : auteur livreur réduit au prénom |
| Alertes opérationnelles (`/api/operational-alerts`) | `src/domains/operational-alerts/operational-alerts.service.ts:13` | n'exposent que l'auteur de la prise en compte ou de la résolution, réservées au personnel (`canActOnOperationalAlerts`) : inchangé |
| Événements de suivi (affectation, retrait, refus, annulation) | règles `src/domains/delivery/client-driver.ts` | descriptions de ces libellés vidées ; « Livreur Prénom Nom » → « Livreur Prénom » ; nom complet connu → prénom |
| Notifications / e-mails client | `src/domains/client-portal/notify.service.ts:65,72-73,169-194` ; messages : `order-conversation.service.ts:120` | aucun nom ni téléphone (textes génériques, charge utile sans description) : inchangé |
| Liste des commandes portail et export CSV | `src/domains/order/order.service.ts:201-213` (`CLIENT_ORDER_HISTORY_SELECT`), `:305-320` | livraisons limitées à id, référence et statut ; l'export ne contient pas de livreur : inchangé |
| PDF de preuve | `src/domains/delivery/proof.service.ts:72-79` | ne transmet pas `driverName` au PDF (`proof-pdf.ts:162` reste inutilisé) : inchangé |
| Listes portail (`getClientDeliveries`, dashboard) | `delivery.service.ts:70-92` | ne sélectionnent aucune donnée de livreur : inchangé |
| Page de suivi publique | aucune (pas de route hors session client) | n/a |
