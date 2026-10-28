# Rapport d'agent — Commande par message IA (2026-10-28)

Branche locale `agent/commande-ia`, base `preproduction` (9234600). Aucun push, aucune migration appliquée, aucun appel réel au modèle, aucun serveur ni navigateur lancé.

## Cadrage

- Le back-office ne créait aucune commande : seule `POST /api/portal/orders` (rôle CLIENT) appelle `createClientOrder`. En revanche, la règle RBAC existante accorde `orders:create` à `COMPANY_ADMIN`, `MINI_ADMIN` (module Commandes) et `DISPATCHER` (`prisma/migrations/20261019010000_rbac_reference_data`), `OrderSource.ADMIN` existe et `createClientOrder` accepte `source`.
- Choix retenu : **création pour le compte d'un client choisi**, après relecture et clic humain, `source = ADMIN`, uniquement si la fonction est activée pour l'entreprise. `order.service.ts` n'est pas modifié.
- **Décision produit à confirmer** : `PRODUCT.md` (« la création de commande appartient au portail client ») et `TODO.md` l. 332 décrivent l'existant. Si le propriétaire veut que seul le client crée, la création se désactive en laissant la fonction éteinte ; la route de création peut aussi être retirée sans toucher au brouillon.

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
3. `npm run check` : premier passage rouge (5 erreurs TS dans le test, 1 échec de l'inventaire DATA-02), corrigé, puis 765/765.

## États voisins couverts

Fonction désactivée, clé absente, entreprise inconnue ; texte vide, trop long, expéditeur trop long ; sortie hors schéma, nulle, refus, panne réseau ; injection (sortie avec actions rejetée, aucun accès commande) ; quota horaire, journalier, autre entreprise, deux appels concurrents sur la dernière place ; client d'une autre entreprise, compte personnel, numéro ambigu, client suspendu ; type de livraison désactivé ; double clic (une commande), clé réutilisée (409) ; rôles client, chauffeur, mini-admin sans module, super-administrateur, dispatcher avec permission forcée ; `companyId` du corps ignoré ; JSON invalide.

## Non vérifié

Appel réel à l'API, qualité d'extraction sur de vrais messages, coût réel, parcours navigateur (spec `tests/e2e/order-intake.spec.ts` non lancée), migration sur une base réelle.

## Coût estimé

`claude-haiku-5-5` : 0,10 $ par million de jetons en entrée, 0,50 $ en sortie (skill `claude-api`, relevé du 2026-10-06). Pour environ 1 200 jetons en entrée et 600 à 1 000 en sortie, une analyse coûte **0,0004 à 0,0006 $**. Le pire cas est d'environ 0,0024 $. La température n'est pas transmise, car ce modèle la refuse (erreur 400) ; l'effort `low` la remplace.

## Actions du propriétaire

1. Arbitrer la décision produit ci-dessus.
2. Fournir la clé `ANTHROPIC_API_KEY` côté serveur.
3. Appliquer la migration après la fusion.
4. Faire activer la fonction par l'administration de l'entreprise.
5. Faire qualifier la fiche F10 (contrat, rétention, transferts) avant toute donnée réelle.

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

> - [ ] **INTAKE-1 — Commande par message IA (coller un message)**. Code, tests locaux (30 tests dédiés, `npm run check` 765/765) et documentation sur `agent/commande-ia`. Restent : la décision sur la création côté back-office, la clé serveur, la migration `20261028100000_order_intake_usage`, une recette navigateur (spec écrite), un essai réel sur 20 messages anonymisés avec la mesure du coût, et la qualification de F10. Hors tranche : l'adresse e-mail de transfert et WhatsApp Business (`docs/operations/order-intake/README.md`).
