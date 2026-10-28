# Correctifs Codex (I1, I2) — 2026-10-29

Branche `agent/correctifs-codex`, base fcc0a5c. Aucune migration, aucune écriture hors du worktree.

## I1 — commande IA : anti-doublon atomique
- `createClientOrder` accepte `request.beforeCreate(tx)`, exécutée au début de chacune de ses deux transactions (`src/domains/order/order.service.ts`). Le géocodage reste avant la transaction.
- `createOrderFromIntake` y prend `pg_advisory_xact_lock(hashtextextended(companyId::text || ':' || key::text, 0))` (SQL paramétré) puis relit `(companyId, key)` ; un autre client déjà titulaire → `IDEMPOTENCY_KEY_REUSED` → 409. Même client : rejeu, même commande (contrainte `(customerId, key)` inchangée). Le contrôle rapide hors transaction est conservé.

## I2 — livreur visible par le client
Règle : prénom toujours, téléphone si `Company.settings.portalShowDriverPhone` (défaut true), jamais le nom de famille ; masquage dans la requête et le DTO.
- Réglage : `src/domains/company/portal-settings.service.ts` (`updateSettingsWithClaim`), route `GET/PATCH /api/company/portal-settings` (COMPANY_ADMIN, MINI_ADMIN ; `settings:read/update`), interrupteur « Afficher le téléphone du livreur aux clients » dans `src/app/(back-office)/settings/page.tsx` (ligne min-h-11 = 44 px, désactivée en lecture seule SaaS).
- Règles communes : `src/domains/delivery/client-driver.ts`.

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

Adaptés (effets de bord attendus) : `tenant-boundaries` (lecture du réglage stubbée), `tracking` (doublure du module), inventaire `admin01-tenant-api-boundary-inventory` (66 routes/46 fichiers + `docs/operations/admin01/tenant-api-boundaries.md`).

### Check final
`lourd.sh npm run check` après le dernier commit de code (35f9a62) : exit 0, 1125 tests, 1125 passés, 0 échec (base : 1108).

### SHA
bd9f426 (I1), 195b320 (socle I2), 5aba3ef (câblage I2), 35f9a62 (inventaire/doublures) ; le commit du rapport suit.

### Diff
Voir `git diff --stat fcc0a5c...HEAD | tail -1` dans le message final.

### Non vérifié
- Aucun clic navigateur (interdit) : interrupteur, tap 44 px, page livraison portail à recetter.
- Verrou `pg_advisory_xact_lock` simulé en mémoire, pas exécuté sur PostgreSQL réel (le SQL est paramétré ; `::text` pour typer les paramètres).
- Noms de livreurs cités dans du texte libre saisi par le personnel (motif d'annulation, etc.) : seuls les formats connus sont expurgés.
- Prénom dérivé du nom stocké (carte, suivi partagé) = premier mot : un prénom composé séparé par un espace est tronqué (sens le plus sûr).
- Historique : les anciens événements de suivi restent en base avec les noms ; l'expurgation se fait à la lecture.

### Inventaire des sorties client contenant des données de livreur
| Sortie | Fichier:ligne | Traitement |
|---|---|---|
| `GET /api/portal/deliveries/[id]` (fiche) | `src/domains/delivery/delivery.service.ts:216,226` (route `src/app/api/portal/deliveries/[id]/route.ts`) | select prénom (+téléphone si réglage), `driverName` retiré, chronologie expurgée |
| Page fiche livraison portail | `src/app/(client-portal)/portal/deliveries/[id]/page.tsx:~123` | prénom, téléphone seulement s'il est présent |
| `GET /api/portal/support/contacts` | `src/domains/client-portal/support-contacts.service.ts:72-73` | prénom, téléphone selon réglage, `delivery` réduit (plus de `driverName`) |
| `GET /api/portal/deliveries/map` | `src/domains/delivery/dispatch-map.service.ts:767-768` | « Livreur Prénom » |
| `GET /api/tracking/[id]` (acteur CLIENT, suivi partagé) | `src/domains/tracking/tracking.service.ts:31,33` | « Livreur Prénom », chronologie expurgée |
| Événements de suivi (affectation, retrait, refus, annulation) | `delivery.service.ts:226`, `tracking.service.ts:33`, règles `client-driver.ts` | descriptions de ces événements vidées ; « Livreur Prénom Nom » → « Livreur Prénom » |
| Notifications / e-mails client | `src/domains/client-portal/notify.service.ts:65,72-73` | aucun nom ni téléphone (textes génériques) : inchangé |
| PDF de preuve | `src/domains/delivery/proof.service.ts:72-79` | ne transmet pas `driverName` au PDF (`proof-pdf.ts:162` reste inutilisé) : inchangé |
| Listes portail (`getClientDeliveries`, dashboard) | `delivery.service.ts:70-92` | ne sélectionnent aucune donnée de livreur : inchangé |
| Page de suivi publique | aucune (pas de route hors session client) | n/a |
