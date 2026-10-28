# Rapport agent « Dispatch GPS » — DEMO-3, tranches 3 et 5

Branche `agent/dispatch-gps`, base `integration/2026-10-28`. Aucune migration, aucun serveur, navigateur ni service externe lancé.

## Ce qui change

### Tranche 3 — distance GPS dans l'auto-dispatch

- Nouveau module pur `src/lib/dispatch/dispatch-proximity.ts`. Il calcule la distance haversine (`haversineMeters`, déjà présent) entre la dernière position du livreur (`DriverLocation`) et le point de retrait de la livraison (`pickupLatitude/pickupLongitude`). Le calcul est local : aucun service de trajet n'est appelé.
- Chaque livreur reçoit un statut :

  | Statut | Signification |
  |---|---|
  | `NEAR` | Position récente, dans le rayon |
  | `FAR` | Position récente, hors du rayon |
  | `STALE` | Position trop ancienne |
  | `NO_POSITION` | Aucune position |
  | `OFF_DUTY` | Livreur hors service |
  | `NO_PICKUP` | Retrait non géolocalisé |
  | `DISABLED` | Critère désactivé |

  Seul `NEAR` donne un avantage. Tous les autres statuts sont neutres : le livreur reste éligible et il est départagé par les critères actuels, sans pénalité ni exclusion. La comparaison n'a que deux classes (proche / neutre), donc l'ordre reste transitif.
- **Décision de l'orchestrateur (relecture) : la distance ne sert QUE de départage.** Elle ne passe jamais devant une priorité réglée, une zone ou la charge. Dans tous les modes, l'ordre est exactement celui de l'intégration, avec la distance en dernier critère avant l'ordre stable :
  - **Liste de priorité, sans règle** (réglage par défaut) : priorité course éventuelle, puis charge, puis **distance**.
  - **Liste de priorité, avec règles** : priorité réglée, puis **distance**, puis ordre des règles.
  - **Moins chargé** : charge, puis priorité réglée, puis **distance**.
  - **Zone puis priorité** : le livreur de zone est conservé. Le repli suit la liste de priorité.

  L'option reste donc activée par défaut : elle ne change aucune affectation existante, hormis les égalités. Un test le vérifie sur des réglages enregistrés sans les champs GPS.
- Confidentialité :
  - Les positions sont lues dans **la même requête** que la liste des livreurs (`getCompanyDriversWithActivity(companyId, { withDispatchPosition: true })`, même filtre `companyId`, `status: ACTIVE`, `role DRIVER`). Sans cette option, la liste de `/api/drivers` ne lit aucune position.
  - Seuls les livreurs **en service** (`trackingService(settings).active`) voient leur position utilisée.
  - Un livreur hors service ne renvoie ni distance ni âge de position.
  - Aucune coordonnée ne sort, dans aucune réponse.
- La raison d'affectation est recopiée dans l'historique (`trackingEvent.description`), que le client voit. Elle ne contient donc **aucun chiffre de position** : seulement « · plus proche du point de retrait », et uniquement quand la distance a réellement décidé du choix.
- Explicabilité côté dispatcher : chaque ligne de `GET /api/dispatch/eligible-drivers` porte `proximity` (`status`, `distanceMeters`, `positionAgeSeconds`), sans état de service ni position brute. Aucune interface ne consomme encore `eligible-drivers` : son affichage reste à faire. Les résultats de l'auto-affectation et de la file ne contiennent **aucune** donnée de position (retirée à la relecture, aucun écran ne la lisait).
- Transaction : les distances sont calculées dans `tryAutoAssignDelivery`, **avant et hors** de la transaction d'affectation (`assignDeliveryToDriver`). Cette transaction n'est pas modifiée (leçon DISPATCH-3). Dans la file, les positions sont lues une fois par passage, la charge à chaque livraison.
- Réglages : ajoutés au réglage dispatch existant (JSON `company.settings.dispatchRules`, donc sans migration). Ils sont modifiables dans **Règles dispatch** : case « Tenir compte de la position GPS » (aide : « À égalité, le livreur en service le plus proche du retrait est choisi. ») et deux champs saisis librement, validés au blur et à l'enregistrement (minutes entières, km au pas de 0,1, bornes du schéma ; saisie vide ou illisible = valeur précédente).

### Tranche 5 — notification « prise en charge »

- **Bon moment** : l'acceptation `POST /api/driver/missions/[id]/acknowledgement` avec `action: "accept"`, et non `start`. Raisons :
  - c'est le bouton « Prendre en charge » de l'application livreur ;
  - la mini-démo affiche alors « Le client le voit aussitôt » ;
  - l'événement d'historique s'appelle déjà « Prise en charge confirmée » ;
  - `start` intervient plus tard (départ) et exige que l'acceptation ait déjà eu lieu.
- `acknowledgeDeliveryMissionByDriver` crée la tâche durable `CLIENT_NOTIFICATION` (kind `DELIVERY_ACCEPTED`) **dans la transaction** d'acceptation. Elle n'est lancée (`kickOperationJob`) qu'après validation. Si la transaction échoue, il n'y a pas de tâche.
- Idempotence :
  - La clé est `client-notification:delivery:<id>:accepted:<date d'acceptation>`.
  - Un rejeu d'acceptation ne passe pas par la création : aucune tâche.
  - En cas de double clic concurrent, le perdant échoue au contrôle de version et sa transaction est annulée.
  - Le rejeu de la tâche réutilise le même identifiant de notification et la même clé d'idempotence pour l'e-mail.
  - Un refus suivi d'une nouvelle acceptation est un nouvel événement légitime.
- Livraison de la tâche dans `notify.service.ts` :
  - Préférence `deliveryAlerts` coupée : rien n'est envoyé. `emailNotifications` coupée : notification dans l'application seulement.
  - Client sans e-mail : notification dans l'application seulement.
  - L'e-mail n'est envoyé que si le transport est configuré (`sendTransactionalEmail` existant). La lecture est restreinte au client et à l'entreprise.
  - Si l'acceptation a été retirée ou remplacée avant l'envoi (`missionAcceptedAt` différent), rien n'est envoyé.
- Texte : « Prise en charge » / « Votre livreur a pris en charge LIV-…. ». Le sujet de l'e-mail est le titre seul, comme les e-mails de statut ; la recherche de la livraison, le lien et l'e-mail sont communs aux deux types (factorisés à la relecture). Le nom du livreur n'est pas cité, par prudence (la démo montre « par Lucas »). Le texte de l'**affectation** devient « Un chauffeur a été assigné à … » au lieu de « a pris en charge », pour ne pas annoncer deux prises en charge.

## Fichiers partagés modifiés (à signaler)

- `src/domains/client-portal/notify.service.ts` : ajout du kind `DELIVERY_ACCEPTED`, de `queueDeliveryAcceptedNotification` et de sa livraison ; texte `ASSIGNED` ; branche livraison factorisée (tests de notifications existants verts, assertions inchangées). Aucun autre comportement modifié.
- `src/domains/delivery/delivery.service.ts` : option `withDispatchPosition` de `getCompanyDriversWithActivity` (surcharges ; appel sans option inchangé).
- `src/features/back-office/dispatch-settings-form.tsx` (back-office, hors portail) : un bloc GPS ajouté.
- Pas de modification de `prisma/schema.prisma`, des inventaires `admin01-*`, de la facturation, du portail, du thème, de `order-intake`, ni du PDF ou de la preuve.

## Seuils choisis

| Réglage | Défaut | Bornes | Raison |
|---|---|---|---|
| `gpsProximityEnabled` | `true` | — | La démo promet le GPS ; sans position exploitable, le comportement est identique à l'ancien. |
| `gpsPositionMaxAgeMinutes` | 15 min (limite incluse) | 1–120 | L'application n'enregistre une position que pendant une mission démarrée. Un livreur libre garde donc la position de sa fin de mission. En 15 min en ville, il parcourt au plus 4 à 5 km : l'indication reste utile. Au-delà, elle est jugée périmée. |
| `gpsMaxDistanceKm` | 10 km | 1–100 | Environ le diamètre de Paris intra-muros. Au-delà, être « connu mais loin » ne doit pas l'emporter sur un livreur sans position. |

Il n'y a pas de tolérance d'égalité sur la distance : elle n'intervient qu'en dernier, à égalité de tous les autres critères.

## Checklist de preuves

**Skills invoqués** : `tutelliv-model-router`, `superpowers:test-driven-development`, `karpathy-guidelines`, `superpowers:verification-before-completion`. Sous-agents : `verificateur` (Sonnet) pour `npm run check`, revue de sécurité Sonnet en lecture seule. `explorateur` n'a pas servi : les cibles étaient connues et les lectures directes plus courtes.

**Rouge puis vert, par point** (`node --import tsx --test <fichier>`) :

| Point | Test | Rouge | Vert |
|---|---|---|---|
| Proximité locale, statuts, seuils par défaut | `tests/dispatch-proximity.test.ts` (9) | module absent, 0/1 | 9/9 |
| Choix du livreur, réponse, éligibles | `tests/auto-dispatch-gps.test.ts` (11) | 9 en échec, 2 gardes de non-régression déjà vertes | 11/11 |
| Réglages dans l'écran dispatch (**contrôle statique**, pas un test fonctionnel) | `tests/dispatch-proximity.test.ts` (+1) | 9/10 | 10/10 |
| Notification de prise en charge et acceptation | `tests/mission-acceptance-notification.test.ts` (11) | 9 en échec (kind inconnu, aucune tâche), 2 gardes vertes | 11/11 |

`tests/mission-acknowledgement.test.ts` charge les services avec une liste fermée de dépendances. Il a été adapté, sans changer ses assertions : stubs neutres et `user.findMany`. Il est rouge sans cette adaptation, vert avec.

**Relecture de l'orchestrateur (10 points)** — un commit par point, test rouge d'abord :

| Point | Commit | Rouge → vert |
|---|---|---|
| 1. Option active par défaut, même affectation hors égalité | `31f15da` | test P1 rouge (repli sans règle) → vert après P2/P3 |
| 2. Moins chargé : priorité avant distance | `034fcf9` | P2 : B proche battait A → A |
| 3. Sans règle : charge avant distance | `d6f0670` | P3 : A à 9 km et 6 livraisons battait B → B |
| 4. Une seule requête livreurs + positions | `f837d96` | P4 : 3 échecs (seconde requête, sélection) → vert |
| 5. File : positions une fois par passage | `69ed458` | P5 : positions relues → `["drivers+positions","drivers","drivers"]` |
| 6. Éligibles : lecture dans le `Promise.all`, option ensuite | `7358627` | P6 : seconde requête, champs bruts → vert |
| 7. Texte d'aide (contrôle statique) | `798c53e` | 10/11 → 11/11 |
| 8. Saisie texte validée au blur, pas 0,1 km | `6cbad23` | fonction absente + contrôle statique (rouge sans le formulaire, vérifié) → 13/13 |
| 9. Plus de distance ni d'âge dans les résultats | `2526237` | P9 : `proximity` présent → absent |
| 10. Notification factorisée, sujet aligné | `d2bf366` | sujet « Prise en charge — LIV » → « Prise en charge » ; `notification-idempotency` inchangé, vert |

Les tests initiaux qui encodaient « proche avant moins chargé » ont été alignés sur la décision (charges égales).

**États voisins couverts** :
- aucune position ;
- position périmée, limite de 15 min incluse ;
- coordonnées invalides ;
- horloge du téléphone en avance ;
- deux livreurs à égalité de distance (la charge décide) ;
- livreur hors service, même collé au retrait ;
- livreur d'une autre entreprise (filtre `companyId`, absent des éligibles, livraison introuvable pour une autre entreprise) ;
- livreur proche mais en pause ou à charge maximale ;
- priorité explicite et livreur de zone prioritaires ;
- critère désactivé (aucune lecture de position) ;
- retrait non géolocalisé ;
- dispatch relancé (aucun recalcul ni seconde affectation) ;
- double acceptation, séquentielle et concurrente ;
- refus ;
- échec dans la transaction (aucune tâche, aucun lancement) ;
- livraison sans client ;
- client sans e-mail ;
- préférences désactivées (alerte entière, ou e-mail seul) ;
- acceptation retirée avant l'envoi ;
- autre entreprise ou autre client ;
- charge utile invalide.

**`npm run check` final** : lancé par `verificateur` via `lourd.sh` après le dernier commit de code `d2bf366`. Code de sortie 0. `tsc` sans erreur, `eslint --max-warnings=0` propre, **926 tests, 926 réussis, 0 échec**. Journal relu (aucune ligne `not ok`). Premier passage : 916/916 après `eafe78b`.

**SHA** :
- `3d0ceb8` feat(dispatch) : proximité GPS locale au point de retrait et seuils réglables
- `bc0a2ab` feat(dispatch) : distance GPS au retrait dans l'auto-dispatch et les éligibles
- `3feaa15` feat(dispatch) : réglages GPS dans l'écran des règles dispatch
- `eafe78b` feat(notification) : prévenir le client quand le livreur prend en charge la mission
- `91eed57` docs(dispatch) : rapport
- relecture : `034fcf9`, `d6f0670`, `31f15da`, `f837d96`, `69ed458`, `7358627`, `2526237`, `798c53e`, `6cbad23`, `d2bf366`
- commit de cette mise à jour du rapport (docs)

**`git diff --stat integration/2026-10-28...HEAD | tail -1`** (avant cette mise à jour du rapport) : `12 files changed, 1425 insertions(+), 84 deletions(-)`.

**Non vérifié** :
- aucun clic navigateur : écran Règles dispatch, auto-dispatch depuis le dispatcher, cloche du portail client ;
- aucun téléphone ni GPS réel ;
- aucun e-mail réel ;
- aucune base réelle (services testés avec un Prisma simulé) ;
- aucun E2E écrit ni lancé.

`eligible-drivers` expose `proximity`, mais aucune interface ne l'affiche : à faire dans une tranche UI. La promesse « trajets » de la démo (« Il croise GPS, charge et trajets ») n'est pas couverte : elle relève des tranches 4 et 10.

**Auto-relecture du diff** :
- Sans proximité, le choix est identique à l'ancien : comparateur neutre, ordre des règles conservé, test dédié.
- La transaction d'acceptation n'ajoute qu'un upsert de tâche.
- Le lancement se fait après validation.
- Aucun import orphelin ; aucun reformatage hors sujet.

**Revue de sécurité (Sonnet, lecture seule)** : aucun bloquant. Isolation entreprise, absence de coordonnées (raison sans chiffre, réponses sans latitude ni longitude, hors service non exposé), idempotence et transaction courte : RAS. Remarques :
- **E-mail rejoué si son envoi échoue après la notification** : le seul garde-fou est la clé d'idempotence fournisseur, que `sendTransactionalEmail` transmet bien (en-tête, l.95). C'est le comportement existant des autres notifications, pas une régression.
- **Changement de texte `ASSIGNED`** : voulu, et aucun test ni E2E ne cite l'ancien texte.
- **Défaut préexistant hors périmètre** : `PATCH /api/company/dispatch` renvoie une erreur 500 sur un corps JSON invalide. Non corrigé (hors périmètre confirmé par l'orchestrateur).

**Auto-relecture de la passe de corrections** : distance en dernier critère dans les trois stratégies ; raison « · plus proche du point de retrait » seulement si tous les critères précédents sont égaux ; une requête livreurs par affectation, positions une fois par passage de file ; éligibles sans `settings` ni `driverLocation` ; résultat d'affectation sans donnée de position ; surcharges de `getCompanyDriversWithActivity` typées (la dernière, sans option, sert aux appelants existants).

## Proposition de texte pour l'entrée DEMO-3 de `TODO.md`

> Tranches 3 et 5 livrées le 2026-10-28 (branche `agent/dispatch-gps`, à recetter en navigateur).
> **3 — GPS au dispatch :** l'auto-dispatch départage les égalités par la distance haversine locale entre la position récente des livreurs **en service** et le point de retrait. La distance vient en dernier critère, après priorité réglée, zone et charge : aucune affectation existante ne change hors égalité. Sans position exploitable (aucune, de plus de 15 min, hors service, retrait non géolocalisé), le livreur est neutre, sans exclusion. Seuils réglables dans Règles dispatch (15 min, 10 km, activé par défaut). Distance et âge de la position figurent dans les éligibles du dispatcher (API), pas dans les résultats d'affectation. Aucune coordonnée exposée, aucun chiffre dans l'historique client. Positions lues avec la liste des livreurs, hors transaction, une fois par passage de file.
> **5 — Prise en charge :** quand le livreur accepte la mission, le donneur d'ordre reçoit une notification dans l'application, et un e-mail si ses préférences et son adresse le permettent. Tâche durable `CLIENT_NOTIFICATION` créée dans la transaction ; rejeu, double clic et relance sans doublon ; acceptation retirée avant l'envoi non notifiée. L'affectation annonce désormais « chauffeur assigné ».
> Validation : `npm run check` 926/926 (après `d2bf366`). Restent : clic navigateur (Règles dispatch, auto-dispatch, cloche du portail), e-mail réel, affichage de la distance dans l'interface du dispatcher, et « trajets » (tranches 4 et 10).
