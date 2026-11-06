# Rapport d'agent — Commande par message IA (2026-10-28)

Branche locale `agent/commande-ia`, base `preproduction` (9234600). Aucun push, aucune migration appliquée, aucun appel réel au modèle, aucun serveur ni navigateur lancé.

## Cadrage

- Le back-office ne créait aucune commande : seule `POST /api/portal/orders` (rôle CLIENT) appelle `createClientOrder`. En revanche, la règle RBAC existante accorde `orders:create` à `COMPANY_ADMIN`, `MINI_ADMIN` (module Commandes) et `DISPATCHER` (`prisma/migrations/20261019010000_rbac_reference_data`), `OrderSource.ADMIN` existe et `createClientOrder` accepte `source`.
- Choix retenu : **création pour le compte d'un client choisi**, après relecture et clic humain, `source = ADMIN`, uniquement si la fonction est activée pour l'entreprise. `order.service.ts` n'est pas modifié.
- **Décision produit prise (C11, 28 octobre 2026)** : la création côté back-office est acceptée par le propriétaire pour le compte d'un client choisi, depuis le seul flux « commande par message », après validation du dispatcher. Elle est consignée dans `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et `PRODUCT.md`.

## Livré

| Élément | Fichiers |
|---|---|
| Domaine pur et testable | `src/domains/order-intake/` (schéma Zod strict, échéance Europe/Paris, brouillon, prompt, interface fournisseur, Anthropic, réglage, quota, client, service, formulaire) |
| Routes | `src/app/api/orders/intake/{route,analyze/route,orders/route}.ts` |
| Interface | `src/features/back-office/order-intake/`, pages `/dashboard/orders/intake` et `/dispatch/intake`, boutons dans Commandes et Dispatch |
| Données | modèle `OrderIntakeUsage`, migration `20261028100000_order_intake_usage` (RLS, REVOKE, non appliquée) |
| Documentation | `docs/operations/order-intake/README.md`, `docs/legal/SOUS_TRAITANTS.md` F10, inventaires ADMIN-1 et DATA-02, `.env.example` |

## TDD

1. `tests/order-intake.test.ts` écrit d'abord, puis modules vides : `node --import tsx --test tests/order-intake.test.ts` → **20 échecs sur 20**, puis 20/20 vert après implémentation.
2. `tests/order-intake-routes.test.ts` : **7 échecs sur 10** avant les routes d'analyse et de création et avant l'interface. Le fournisseur Anthropic et la route d'activation avaient été écrits avant leurs tests (écart au TDD). Ils ont été contrôlés par mutation : ajout d'un outil au fournisseur, puis ajout de `DISPATCHER` à l'activation → 2 échecs (le second a fait ajouter un cas), puis code restauré et 10/10 vert.
3. `npm run check` sur la première livraison : un premier passage rouge (5 erreurs TS dans le test, 1 échec de l'inventaire DATA-02), puis 765/765 après correction. Après les corrections de relecture, le contrôle final donne 777/777 (voir la checklist).

## États voisins couverts

Fonction désactivée, clé absente, entreprise inconnue ; texte vide, trop long, expéditeur trop long ; sortie hors schéma, nulle, refus, panne réseau ; injection (sortie avec actions rejetée, aucun accès commande) ; quota horaire, journalier, autre entreprise, deux appels concurrents sur la dernière place ; client d'une autre entreprise, compte personnel, numéro ambigu, client suspendu ; type de livraison désactivé ; double clic (une commande), clé réutilisée (409) ; rôles client, chauffeur, mini-admin sans module, super-administrateur, dispatcher avec permission forcée ; `companyId` du corps ignoré ; JSON invalide.

## Non vérifié

Appel réel à l'API, qualité d'extraction sur de vrais messages, coût réel, parcours navigateur (spec `tests/e2e/order-intake.spec.ts` non lancée), migration sur une base réelle.

## Coût estimé

`claude-haiku-5-5` : 0,10 $ par million de jetons en entrée, 0,50 $ en sortie (skill `claude-api`, relevé du 2026-10-06). Pour environ 1 200 jetons en entrée et 600 à 1 000 en sortie, une analyse coûte **0,0004 à 0,0006 $**. Le pire cas est d'environ 0,0024 $. La température n'est pas transmise, car ce modèle la refuse (erreur 400) ; l'effort `low` la remplace.

## Actions du propriétaire

1. Fournir la clé `ANTHROPIC_API_KEY` côté serveur.
2. Appliquer la migration après la fusion.
3. Faire activer la fonction par l'administration de l'entreprise.
4. Faire qualifier la fiche F10 (contrat, rétention, transferts) avant toute donnée réelle.

## Complément du 28 octobre : décision C11 et retours de relecture

La décision C11 (création côté back-office acceptée) est consignée dans `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et dans `PRODUCT.md`. Chaque retour de relecture a d'abord reçu un test rouge, puis un commit dédié :

1. L'échéance est justifiée par son propre extrait, y compris quand le mode est absent.
2. `SAAS_ORDER_CREATION_BLOCKED` et `SAAS_ACCOUNT_READ_ONLY` renvoient un 403 explicite. Le géocodage ne lève pas d'erreur.
3. Seul un client actif est rapproché.
4. L'enlèvement est commun à toutes les livraisons.
5. L'expéditeur est placé dans le cadre `<expediteur>`.
6. Une clé déjà utilisée pour un autre client renvoie un 409. Il reste une course théorique entre deux clients simultanés, car la contrainte d'unicité existante porte sur la paire (client, clé).
7. Une date passée sans heure est signalée comme passée.
8. L'activation est atomique (`jsonb_set`).
9. Une clé refusée renvoie `INTAKE_NOT_CONFIGURED` et rend la place de quota ; le `Retry-After` dépend de la fenêtre atteinte.
10. Le rapprochement par téléphone se fait en SQL, de façon déterministe.
11. Toutes les cibles cliquables font au moins 44 px.

Les requêtes SQL brutes (`jsonb_set`, `regexp_replace`) sont testées sur leur forme et leurs paramètres. Elles n'ont pas été exécutées sur PostgreSQL.

## Mise à jour proposée de `TODO.md` (non appliquée)

> - [ ] **INTAKE-1 — Commande par message IA (coller un message)**. Code, tests locaux (42 tests dédiés, `npm run check` 777/777) et documentation sur `agent/commande-ia`. La création côté back-office est décidée (C11, 28 octobre 2026). Restent : la clé serveur, la migration `20261028100000_order_intake_usage`, une recette navigateur (spec écrite), un essai réel sur 20 messages anonymisés avec la mesure du coût, et la qualification de F10. Hors tranche : l'adresse e-mail de transfert et WhatsApp Business (`docs/operations/order-intake/README.md`).

## Checklist de preuves

**Skills invoqués** : `annona-model-router`, `claude-api`, `superpowers:test-driven-development` (invoqué en cours de travail, pas avant le premier test ; les tests ont pourtant été écrits d'abord), `karpathy-guidelines`, `security-review`, `superpowers:verification-before-completion`.

**Corrections de relecture.** Chaque test rouge a été lancé par `node --import tsx --test`, puis le même test est passé au vert après le correctif.

| # | Correction | Rouge | Vert | Commit |
|---|---|---|---|---|
| 1 | L'échéance est justifiée par son propre extrait, même sans mode | 1 échec | 21/21 | `5daf53b` |
| 2 | Refus d'abonnement en 403 explicite (`SAAS_ORDER_CREATION_BLOCKED`, `SAAS_ACCOUNT_READ_ONLY`) | 2 échecs (domaine et route) | 32/32 | `bb7ce71` |
| 3 | Seul un client ACTIVE est rapproché | 1 échec | 23/23 | `341e2b3` |
| 4 | Enlèvement commun aux livraisons (`updateIntakeStop`) | 1 échec | 34/34 | `f68d873` |
| 5 | Expéditeur dans un cadre `<expediteur>` échappé | 1 échec | 35/35 | `a5f9d0a` |
| 6 | Clé déjà utilisée pour un autre client → 409, sans doublon | 1 échec | 36/36 | `aafbb70` |
| 7 | Date passée sans heure → passée (minuit à Paris) | 1 échec | 27/27 | `690fad2` |
| 8 | Activation atomique (`UPDATE … jsonb_set`) | 1 échec | 38/38 | `0278fdd` |
| 9 | Clé refusée → `INTAKE_NOT_CONFIGURED` et place de quota rendue ; `Retry-After` selon la fenêtre atteinte | 3 échecs | 41/41 | `06306ab` |
| 10 | Rapprochement téléphone en SQL paramétré, trié, limité à 2 lignes | 1 échec | 41/41 | `4334643` |
| 44 px | `min-h-11` sur les boutons, les cases à cocher et les liens d'entrée | 1 échec | 11/11 | `b676da0` |

Les comptes « vert » portent sur le fichier ou les fichiers de test lancés à cette étape.

**États voisins** : ceux de la section « États voisins couverts », plus les cas ajoutés en relecture :
- échéance sans mode ou sans extrait ;
- client inactif, suspendu ou non vérifié ;
- changement d'onglet après une correction de l'enlèvement ;
- expéditeur hostile ;
- clé réutilisée pour un autre client, puis pour le même client ;
- date passée sans heure, autour de minuit à Paris ;
- entreprise absente lors de l'activation ;
- fournisseur qui refuse la clé ou qui est saturé ;
- quota horaire et quota journalier ;
- deux clients partageant un même numéro.

**`npm run check` final** : lancé par `lourd.sh` après `b21dfef`. Code de sortie 0, 777 tests sur 777 réussis.

**SHA** (du plus ancien au plus récent) :
- livraison : `a3305a5`, `845bd6d`, `8e8de96`, `f204803` ;
- décision C11 : `a5b6046` ;
- corrections : `5daf53b`, `bb7ce71`, `341e2b3`, `f68d873`, `a5f9d0a`, `aafbb70`, `690fad2`, `0278fdd`, `06306ab`, `4334643`, `b676da0` ;
- documentation : `8c73820` ;
- test : `b21dfef`.

**`git diff --stat preproduction...HEAD | tail -1`** (avant ce commit) : `39 files changed, 3375 insertions(+), 12 deletions(-)`.

**Non vérifié** :
- le SQL brut (`jsonb_set`, `regexp_replace`, verrou consultatif) n'a jamais été exécuté sur PostgreSQL ; il est testé seulement sur sa forme et ses paramètres ;
- aucun parcours navigateur (la spec `tests/e2e/order-intake.spec.ts` n'a pas été lancée) ;
- aucun appel réel au modèle ;
- coût réel non mesuré ;
- migration non appliquée.

**Auto-relecture et revue de sécurité.**
- *Auto-relecture* : j'ai renoncé à `withApiHandler`, qui renvoie `error.message` dans ses réponses 500, et corrigé le typage des tests, l'inventaire DATA-02, la comparaison d'objets créés en vm et le report des livraisons manquantes. Un cas « dispatcher avec `settings:update` » a été ajouté après la mutation.
- *Revue `security-review`* (sous-agent en lecture seule) : aucune vulnérabilité de confiance ≥ 8. Points contrôlés : isolement par entreprise, IDOR sur `customerId`, élévation de privilège, `$queryRaw` paramétré, injection de prompt sans effet hors brouillon, erreurs sans détail interne, absence de XSS.

**Écarts** :
- Le fournisseur Anthropic et la route d'activation ont été écrits avant leurs tests. Je les ai vérifiés par mutation (2 échecs), puis restaurés.
- **Course restante n° 6** : deux créations simultanées pour deux clients différents avec la même clé peuvent encore passer, car la contrainte d'unicité existante porte sur la paire (client, clé). Le risque est très faible.
- Un `npx tsc` a été lancé hors du verrou `lourd.sh`, après la correction des regex.
- Le premier `npm run check` final est sorti avec le code 2 (drapeau de regex `s`, erreur TS1501) ; c'est corrigé par `b21dfef`.
- Le lien « Depuis un message » du Dispatch fait 44 px, plus que ses voisins (32 px), que je n'ai pas modifiés.
