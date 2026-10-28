# Commande par message IA (tranche « coller un message »)

État : 28 octobre 2026, branche `agent/commande-ia`. Code et tests locaux présents ; **aucun appel réel au modèle, aucune recette navigateur, migration non appliquée.**

## Problème traité

Les commandes arrivent par e-mail, SMS ou WhatsApp et le dispatcher les ressaisit (voir `docs/VISION_PRODUIT_COMMERCIALE.md`, 2.2). Le message court et urgent (« urgent, 2 plis de Rivoli à La Défense avant 15h, demander M. Durand ») est le cas visé.

## Parcours

1. Back-office → **Commandes → « Nouvelle commande depuis un message »** (`/dashboard/orders/intake`, administrateur et mini-admin avec le module Commandes) ou **Dispatch → « Depuis un message »** (`/dispatch/intake`, administrateur et dispatcher).
2. Le dispatcher colle le texte (8 000 caractères au plus) et, s'il le connaît, l'e-mail ou le téléphone de l'expéditeur, puis clique sur **Analyser** (ou Ctrl/⌘ + Entrée).
3. Le serveur renvoie un **brouillon** : enlèvement, livraisons (une ou plusieurs), échéance résolue dans le fuseau Europe/Paris, urgence, nature et quantité des colis, consignes, client probable. Chaque champ porte une confiance et l'extrait exact du message ; un extrait introuvable dans le texte est retiré et le champ marqué « À vérifier ». Les champs absents sont listés « À compléter ».
4. Le dispatcher corrige, choisit le client, puis clique sur **Créer la commande**. Une commande est créée par livraison, avec `source = ADMIN`, via `createClientOrder` (inchangé) : géocodage serveur, contrôles SaaS, auto-dispatch, idempotence.

## Garde-fous

| Risque | Défense |
|---|---|
| Injection de prompt | Le message est encadré comme donnée (`<message>`), ses balises sont neutralisées ; aucun outil n'est déclaré ; sortie au format JSON Schema puis revalidée par un Zod strict (aucun champ en plus, aucune coordonnée, aucun identifiant) ; rien n'est créé sans clic. |
| Coordonnées inventées | Le schéma n'a aucun champ de coordonnées ; le géocodage reste celui de `createClientOrder`. |
| Mauvais client | Rapprochement par e-mail ou téléphone de l'expéditeur, comptes `CLIENT` de l'entreprise de la session uniquement ; un numéro partagé par deux clients ne donne rien. À la création, le client doit appartenir à l'entreprise et être actif. |
| Double clic | Bouton désactivé pendant l'envoi + clé `Idempotency-Key` fixée par livraison à l'analyse : le service existant rend la même commande. Une clé déjà utilisée dans l'entreprise pour un autre client est refusée (409), ce qui évite un doublon après une réponse perdue suivie d'un changement de client. |
| Coût, abus | 60 analyses par heure et 300 par jour **par entreprise**, comptées sous verrou consultatif PostgreSQL (table `order_intake_usage`). `Retry-After` indique quand l'appel le plus ancien sort de la fenêtre atteinte. Une clé refusée ou un fournisseur saturé rendent la place réservée. |
| Données personnelles | Le texte n'est jamais stocké ; le journal garde l'entreprise, le modèle, l'issue et les jetons. Sous-traitant documenté : `docs/legal/SOUS_TRAITANTS.md`, F10. |
| Panne | Désactivée, non configurée, quota, refus du modèle ou réponse invalide : message clair, codes 403/429/422/502/503, jamais de 500 ni de détail interne. |

Permissions : `orders:create` et rôles `COMPANY_ADMIN`, `MINI_ADMIN`, `DISPATCHER` pour l'analyse et la création ; `settings:update` et `COMPANY_ADMIN`, `MINI_ADMIN` pour l'activation. Routes inscrites dans `docs/operations/admin01/tenant-api-boundaries.md`.

## Activation (propriétaire)

1. Créer une clé API Anthropic sur le compte de l'entreprise TutelLiv et la poser en variable serveur `ANTHROPIC_API_KEY` (Vercel, environnement voulu). `.env.example` la liste vide.
2. Appliquer la migration `prisma/migrations/20261028100000_order_intake_usage` (table interne, RLS, aucun droit public), après fusion et selon `docs/DATABASE.md`.
3. Dans l'écran, un administrateur lit la mention sur le sous-traitant, coche la case et clique sur **Activer la fonction** (réglage `companies.settings.orderIntake.enabled`).
4. Faire qualifier F10 (contrat, rétention chez le fournisseur, transferts) avant d'y faire passer des données réelles.

## Modèle et coût estimé

`claude-haiku-5-5`, sortie structurée, effort `low`, `max_tokens` 4 096, consigne système mise en cache. La température n'est pas réglable : ce modèle refuse toute valeur non par défaut. Tarifs du skill `claude-api` (relevé du 2026-10-06, prompts ≤ 100 000 jetons) : 0,10 $ par million de jetons en entrée, 0,50 $ en sortie.

Estimation **non mesurée** : message type ≈ 1 200 jetons en entrée et 600 à 1 000 en sortie, soit **0,0004 à 0,0006 $ par analyse**. Pire cas (8 000 caractères, sortie au plafond) ≈ 0,0024 $. Une entreprise à 50 messages par jour dépenserait environ 1 $ par mois ; au plafond de 300 par jour, 5 à 22 $ par mois. À confirmer par le journal d'usage après les premiers appels réels.

## Hors tranche (documenté, non développé)

- **Adresse e-mail dédiée de transfert** (`commandes@…`) : un service de réception (« inbound parse » chez un fournisseur e-mail) poste le message sur un webhook signé ; le webhook crée un brouillon en file d'attente, jamais une commande. À décider : fournisseur (Resend est déjà pressenti pour l'envoi), sous-domaine et enregistrements MX/SPF/DKIM, coût par message, durée de conservation des e-mails reçus, authentification de l'expéditeur, information des clients. Nouveau flux de sous-traitance à qualifier.
- **WhatsApp Business** : API Cloud de Meta en direct ou via un fournisseur agréé ; vérification de l'entreprise, numéro dédié, modèles de messages approuvés hors fenêtre de 24 h, tarification par conversation ou par message à vérifier au moment du choix, consentement explicite des clients (opt-in) et information RGPD. Mêmes règles : brouillon puis validation humaine.

Ces deux canaux réutiliseraient tel quel le domaine `src/domains/order-intake` (analyse, brouillon, quota), seule l'entrée change.

## Tests

- `tests/order-intake.test.ts` : extraction sur fixtures e-mail, SMS, WhatsApp, multi-livraisons ; dates relatives à Paris (heure d'hiver et d'été) ; champs manquants ; extrait inventé ; sortie hors schéma ; injection ; texte trop long ; fonction désactivée ou clé absente ; quota par entreprise et concurrent ; rapprochement client dans l'entreprise ; double clic.
- `tests/order-intake-routes.test.ts` : rôles refusés, entreprise de la session, statuts HTTP, activation, fournisseur Anthropic simulé (paramètres, refus, troncature, JSON illisible), interface et documentation.
- `tests/e2e/order-intake.spec.ts` : parcours navigateur écrit, **non lancé**.
