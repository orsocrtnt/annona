# Commande par message IA (tranche « coller un message »)

Suite prévue : [MAIL-PONT, boîte de commandes dédiée](MAIL-PONT.md) (spécification du 3 novembre 2026, à relire par le propriétaire) ; [WHATSAPP-1, commandes WhatsApp](WHATSAPP.md) (spécification du 4 novembre 2026, à relire, en attente du SIREN).

État : 28 octobre 2026, branche `agent/commande-ia`. Code et tests locaux présents ; **aucun appel réel au modèle, aucune recette navigateur, migration non appliquée.**

## Problème traité

Les commandes arrivent par e-mail, SMS ou WhatsApp et le dispatcher les ressaisit (voir `docs/VISION_PRODUIT_COMMERCIALE.md`, 2.2). Le message court et urgent (« urgent, 2 plis de Rivoli à La Défense avant 15h, demander M. Durand ») est le cas visé.

## Parcours

1. Back-office → **Commandes → « Depuis un message »** (`/dashboard/orders/intake`, administrateur et mini-admin avec le module Commandes) ou **Dispatch → « Depuis un message »** (`/dispatch/intake`, administrateur et dispatcher).
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

1. Créer une clé API Anthropic sur le compte de l'entreprise Annona et la poser en variable serveur `ANTHROPIC_API_KEY` (Vercel, environnement voulu). `.env.example` la liste vide.
2. Appliquer la migration `prisma/migrations/20261028100000_order_intake_usage` (table interne, RLS, aucun droit public), après fusion et selon `docs/DATABASE.md`.
3. Dans l'écran, un administrateur lit la mention sur le sous-traitant, coche la case et clique sur **Activer la fonction** (réglage `companies.settings.orderIntake.enabled`).
4. Faire qualifier F10 (contrat, rétention chez le fournisseur, transferts) avant d'y faire passer des données réelles.

## Modèle et coût estimé

`claude-haiku-5-5`, sortie structurée, effort `low`, `max_tokens` 4 096, consigne système mise en cache. La température n'est pas réglable : ce modèle refuse toute valeur non par défaut. Tarifs du skill `claude-api` (relevé du 2026-10-06, prompts ≤ 100 000 jetons) : 0,10 $ par million de jetons en entrée, 0,50 $ en sortie.

Estimation **non mesurée** : message type ≈ 1 200 jetons en entrée et 600 à 1 000 en sortie, soit **0,0004 à 0,0006 $ par analyse**. Pire cas (8 000 caractères, sortie au plafond) ≈ 0,0024 $. Une entreprise à 50 messages par jour dépenserait environ 1 $ par mois ; au plafond de 300 par jour, 5 à 22 $ par mois. À confirmer par le journal d'usage après les premiers appels réels.

## Réception automatique des e-mails (MAIL-COMMANDE, 30 octobre 2026)

Chaque entreprise active une adresse `<jeton>@<INBOUND_EMAIL_DOMAIN>` vers laquelle elle transfère ses e-mails de commande. Un e-mail reçu devient un brouillon à relire : aucune commande n'est créée sans validation humaine. Code présent, testé avec fournisseur et modèle simulés.

Mise en service (propriétaire) :

1. Dans Resend (Domains), ajouter `commandes.annona.fr` en réception et poser le MX indiqué dans la zone OVH. Ne pas toucher au MX de `annona.fr`, qui sert la boîte OVH.
2. Dans Resend (Webhooks), créer un webhook `email.received` vers `https://annona.fr/api/webhooks/inbound-email` et copier son secret.
3. Dans Vercel (Preview, branche `preproduction`) : `INBOUND_EMAIL_DOMAIN=commandes.annona.fr` et `RESEND_INBOUND_WEBHOOK_SECRET=<secret>`. `RESEND_API_KEY` doit avoir le droit de lire les e-mails reçus.
4. Poser `ANTHROPIC_API_KEY` (ci-dessus) et activer la fonction ; sans elle, l'e-mail reste lisible et « À lire », sans brouillon.

Garde-fous : signature Svix vérifiée sur le corps brut (5 minutes de tolérance), expéditeur jamais considéré comme prouvé, 200 e-mails par jour et par entreprise, texte seul (HTML réduit, pièces jointes non lues), corps et brouillon effacés au traitement, ligne supprimée après 30 jours.

## Commandes WhatsApp (WHATSAPP-1, option A, 4 novembre 2026)

Un membre de l'équipe transfère le message WhatsApp d'un client au numéro WhatsApp de Annona. Le message rejoint la liste des messages reçus, avec la même analyse, le même tri et la même validation que l'e-mail. Spécification et option B (numéro de l'entreprise relié) : [WHATSAPP.md](WHATSAPP.md).

- Webhook `GET/POST /api/webhooks/whatsapp` : abonnement par `WHATSAPP_VERIFY_TOKEN`, signature `X-Hub-Signature-256` vérifiée avec `WHATSAPP_APP_SECRET` sur le corps brut.
- Entreprise reconnue par le numéro du membre (profil, rôles administrateur, mini-admin ou dispatcher, compte actif) ; numéro inconnu ou présent dans deux entreprises : ignoré, rien n'est gardé. L'entreprise doit activer « WhatsApp » dans ses réglages.
- Le numéro du membre n'est jamais pris pour le client : le client est cherché par l'e-mail, sinon le téléphone, écrits dans le message ; l'e-mail lu reçoit la confirmation.
- Photo, vocal ou document : non lus, rangés dans « À trier » (la légende d'une photo est lue).
- Variables : `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DISPLAY_NUMBER`.

## Hors tranche (documenté, non développé)

- **WhatsApp, option B** (numéro de chaque entreprise relié par l'inscription intégrée de Meta) : voir [WHATSAPP.md](WHATSAPP.md). Modèles de messages approuvés hors fenêtre de 24 h, consentement des clients et information RGPD à traiter. Mêmes règles : brouillon puis validation humaine.

Ces deux canaux réutiliseraient tel quel le domaine `src/domains/order-intake` (analyse, brouillon, quota), seule l'entrée change.

## Tests

- `tests/order-intake.test.ts` : extraction sur fixtures e-mail, SMS, WhatsApp, multi-livraisons ; dates relatives à Paris (heure d'hiver et d'été) ; champs manquants ; extrait inventé ; sortie hors schéma ; injection ; texte trop long ; fonction désactivée ou clé absente ; quota par entreprise et concurrent ; rapprochement client dans l'entreprise ; double clic.
- `tests/order-intake-routes.test.ts` : rôles refusés, entreprise de la session, statuts HTTP, activation, fournisseur Anthropic simulé (paramètres, refus, troncature, JSON illisible), interface et documentation.
- `tests/e2e/order-intake.spec.ts` : parcours navigateur écrit, **non lancé**.
- `tests/whatsapp-intake.test.ts` : signature Meta, abonnement, lecture des messages, entreprise du membre qui transfère, numéro inconnu ou ambigu, option B ignorée tant qu'elle n'est pas branchée ; `tests/e2e/public-order.spec.ts` (« WHATSAPP ») : parcours complet jusqu'à la commande.
