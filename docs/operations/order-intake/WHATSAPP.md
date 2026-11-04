# WHATSAPP-1 — Recevoir les commandes WhatsApp

4 novembre 2026. Rédigée par l'agent à la demande du propriétaire (« on peut faire WhatsApp ? »), **à relire par le propriétaire**. Aucun code n'est écrit. Les choix encore ouverts sont rassemblés en section 9 : rien n'est engagé tant qu'ils ne sont pas tranchés.

## 1. Objectif

Aujourd'hui, un dispatcher peut déjà copier un message WhatsApp et le coller dans « Depuis un message » (INTAKE-1). TutelLiv en fait un brouillon à relire.

L'objectif est d'enlever le copier-coller : le message WhatsApp arrive dans TutelLiv et devient un brouillon, comme un e-mail de commande (MAIL-PONT). Les règles ne changent pas :

1. jamais de commande sans le clic du dispatcher ;
2. client reconnu si possible, sinon fiche client sans accès créée à la validation (MAIL-PONT, étape 4) ;
3. les messages qui ne sont pas des commandes sont rangés dans « À trier ».

Hors périmètre : répondre au client depuis TutelLiv, gérer les photos et les messages vocaux, et le chat en direct.

## 2. Ce qui existe déjà et sera réutilisé

| Élément | Où | Réutilisation |
| --- | --- | --- |
| Analyse d'un message en brouillon, quota, champs « À vérifier » | `src/domains/order-intake/` (INTAKE-1) | Telle quelle |
| File des messages reçus, tri `order`/`other`, « À trier », effacement à la clôture | `InboundOrderEmail`, [inbound-email.service.ts](../../../src/domains/order-intake/inbound-email.service.ts) | À généraliser à un canal « WhatsApp » |
| Client lu dans un message transféré par l'équipe | `forwardedSender` (MAIL-PONT, étape 2) | Même idée, mais WhatsApp ne donne pas l'expéditeur d'origine (section 4.2) |
| Fiche client sans accès | `CompanyCustomer` (MAIL-PONT, étape 4) | Telle quelle |
| Confirmation au client avec lien de suivi | MAIL-PONT, étape 5 | Par e-mail seulement si une adresse est connue ; pas de réponse WhatsApp dans cette tâche |

## 3. Ce que WhatsApp permet, vérifié en ligne le 4 novembre 2026

- **Pas de renvoi automatique.** Contrairement à Gmail, WhatsApp ne sait pas renvoyer tous les messages d'un numéro vers un autre.
- **API officielle de Meta (Cloud API).** C'est la seule voie autorisée pour recevoir des messages par programme. Elle demande un compte Meta Business, un numéro enregistré chez Meta et un webhook. L'accès est gratuit, sans abonnement.
- **Vérification de l'entreprise par Meta.** Meta vérifie que l'entreprise existe légalement et que la personne qui fait la demande la représente. Il faut des documents officiels : extrait d'immatriculation, numéro fiscal, justificatif d'adresse, site web. Sans vérification, les plafonds sont bas (environ 250 destinataires par jour selon des prestataires) et le nombre de numéros est limité. Sources secondaires, à confirmer dans l'aide de Meta.
- **Tarifs (page officielle de Meta).** Les messages envoyés par les clients sont gratuits. Les messages envoyés par l'entreprise sont facturés à l'unité depuis le 1er juillet 2025. Depuis le 1er octobre 2026, chaque numéro dispose de 1 000 messages de service gratuits par mois, puis ils sont payants. Les messages utilitaires envoyés dans la fenêtre de 24 heures sont payants eux aussi depuis cette date. Les montants pour la France sont dans les grilles de Meta (non relevées ici).
- **Messages transférés.** Un message transféré arrive marqué `forwarded` (ou `frequently_forwarded` au-delà de cinq transferts), **sans l'auteur d'origine** : rien dans le webhook ne dit qui l'a écrit en premier.
- **« Coexistence ».** Meta permet d'utiliser le même numéro dans l'application WhatsApp Business et dans l'API, en passant par l'inscription intégrée d'un prestataire technique de Meta. Les appels et les groupes restent dans l'application. La disponibilité en France n'a pas été confirmée.
- **Règle de Meta sur l'IA (en vigueur depuis le 15 janvier 2026).** Elle interdit de distribuer un assistant d'IA généraliste par l'API. Selon la presse et des prestataires, l'IA utilisée dans un flux métier reste permise (support, ventes, notifications). L'usage de TutelLiv, qui lit une commande dans un message, semble relever de ce cas. Ce n'est pas vérifié dans le texte de Meta. La Commission européenne examine cette règle depuis février 2026.

## 3 bis. Commencer sans attendre le SIREN (ajout du 4 novembre 2026)

Le propriétaire a demandé s'il existait un autre chemin. Il y en a deux :

1. **Tout de suite, sans code : WhatsApp → Partager → e-mail.** Le dispatcher sélectionne le message dans WhatsApp, le partage par e-mail vers l'adresse de commandes de l'entreprise (MAIL-PONT). Le message suit le circuit e-mail existant : tri, brouillon, fiche client, validation. Le client est reconnu par le téléphone ou l'e-mail écrit dans le message, comme en section 4.3. Le geste exact dépend du téléphone (iPhone : appui long, « Transférer », puis l'icône de partage ; Android : selon la version) : à essayer sur un vrai téléphone avant de l'écrire dans le guide.
2. **L'API officielle sans vérification de l'entreprise.** Selon plusieurs prestataires, un compte Meta Business non vérifié peut utiliser l'API avec des plafonds bas : environ 250 conversations **lancées par l'entreprise** par jour et 2 numéros. Les messages **reçus** et les réponses dans une conversation ouverte par l'autre personne ne sont pas plafonnés de la même façon. L'option A reçoit des messages transférés et n'en lance presque pas : ces plafonds ne la gênent pas pour les pilotes. Meta fournit aussi un **numéro de test** dans l'application développeur, ce qui permet de coder et d'essayer avant d'avoir une ligne dédiée. Le compte peut être ouvert au nom du propriétaire, puis vérifié au nom de la société quand le SIREN existe. Sources secondaires : à confirmer dans l'aide de Meta lors de l'ouverture du compte.

Écarté : les bibliothèques non officielles qui pilotent WhatsApp Web (`whatsapp-web.js`, Baileys). Elles sont contraires aux conditions de WhatsApp, le numéro peut être banni sans préavis, et elles cassent à chaque mise à jour. Pas pour un service qui traite les données des clients.

## 4. Deux façons de brancher WhatsApp

### 4.1 Option A, conseillée pour commencer : un numéro TutelLiv

TutelLiv possède **un seul numéro WhatsApp**, enregistré à son nom chez Meta.

1. Le client écrit comme d'habitude sur le WhatsApp de l'entreprise de livraison.
2. Le dispatcher appuie sur « Transférer » et choisit le contact « TutelLiv Commandes ».
3. TutelLiv reconnaît l'entreprise et le membre de l'équipe par le **numéro du dispatcher**. Ce numéro doit être enregistré sur son compte TutelLiv, sinon le message est ignoré et un seul message d'aide lui est renvoyé.
4. Le message devient un brouillon dans la liste des messages reçus, avec la mention « reçu par WhatsApp, transféré par … ».

Points forts : rien à faire chez l'entreprise de livraison, qui garde son téléphone et son application ; une seule vérification Meta, celle de TutelLiv ; un coût presque nul, puisque les messages reçus sont gratuits. Limites : il reste un geste par message (transférer), et le client d'origine n'est pas connu automatiquement (section 4.3).

### 4.2 Option B, plus tard : le numéro de l'entreprise relié directement

Chaque entreprise relie son propre numéro WhatsApp Business à TutelLiv, par la « coexistence » de la section 3. Chaque message de client arrive alors tout seul, avec le vrai numéro du client, et le client est reconnu par son téléphone.

Limites : TutelLiv doit devenir prestataire technique de Meta (*Tech Provider*) ou passer par un prestataire agréé. Chaque entreprise doit avoir un compte Meta Business, et sa vérification est probablement nécessaire. Le tri doit ignorer les conversations privées et l'équipe. Les données personnelles et le juridique sont plus lourds. À reconsidérer seulement si les pilotes montrent que le geste « Transférer » freine vraiment.

### 4.3 Reconnaître le client (option A)

WhatsApp ne transmet pas l'auteur d'un message transféré (section 3). Ordre de reconnaissance :

1. **Téléphone ou e-mail écrits dans le message** : déjà lus par le modèle (`customerHint`), puis rapprochés des comptes et des fiches de l'entreprise.
2. **Nom écrit dans le message** : proposé seulement à titre indicatif, jamais présélectionné.
3. Sinon, le dispatcher choisit le client ou crée la fiche. Le formulaire est celui de MAIL-PONT, sans e-mail prérempli.

Amélioration possible (à décider, section 9) : le dispatcher transfère d'abord la **carte de contact** du client, puis son message. TutelLiv associerait la carte au message suivant du même dispatcher, pendant quelques minutes.

## 5. Réception et tri (option A)

- **Webhook signé** : la signature `X-Hub-Signature-256` est vérifiée avec le secret de l'application Meta, sur le corps brut, comme le webhook Resend. Le jeton de vérification sert à l'abonnement.
- **Seuls les messages texte** sont analysés. Une image, un message vocal ou un document est gardé en attente avec la mention « contenu non lu (photo, vocal ou document) », sans appel au modèle. C'est la même règle que pour une pièce jointe d'e-mail.
- **Tri** : même appel au modèle que pour l'e-mail (`order` ou `other`), rangement dans « À trier », effacement au bout de 7 jours.
- **Plafonds** : ceux de la boîte e-mail (200 messages par jour et par entreprise, 60 analyses par heure).
- **Numéro inconnu** : aucun stockage du contenu ; au plus un message d'aide par numéro et par jour (« Ce numéro n'est relié à aucun compte TutelLiv »). Ce message est un message de service : dans le quota gratuit de 1 000 par mois.

## 6. Ce qu'il faut côté TutelLiv (propriétaire)

| Étape | Qui | Dépendance |
| --- | --- | --- |
| Compte développeur Meta et compte Meta Business (non vérifié au début, section 3 bis) | Toi | Ton compte Facebook |
| Application Meta (développeur), produit WhatsApp, numéro de test, abonnement du webhook | Claude, avec ton accès | Étape précédente |
| Numéro dédié, capable de recevoir un SMS ou un appel pour le code Meta, jamais utilisé dans l'application WhatsApp | Toi | Une ligne fixe ou mobile à toi ; utile pour les pilotes, pas pour coder |
| Vérification de l'entreprise, jeton permanent d'un utilisateur système | Toi, puis Claude | SIREN, justificatif d'adresse, site tutelliv.fr ; seulement pour dépasser les plafonds |
| Variables Vercel : `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | Toi (l'agent n'y a pas accès) | Étape précédente |

## 7. Sécurité, données et juridique

- **Expéditeur** : le numéro du dispatcher est fourni par Meta, il est donc plus fiable qu'un `From` d'e-mail. Il ne sert qu'à trouver l'entreprise ; la validation reste humaine.
- **Données** : le texte est effacé à la clôture, comme pour l'e-mail ; le numéro de l'expéditeur est gardé 30 jours avec la ligne.
- **Sous-traitant** : Meta (WhatsApp) devient un sous-traitant de TutelLiv pour ce canal. Il faut l'ajouter à `docs/legal/SOUS_TRAITANTS.md`, à la notice des clients et au DPA, avec les transferts hors de l'Union européenne. À traiter avec LEGAL-1 avant les données réelles.
- **Information des clients finaux** : l'entreprise de livraison doit savoir, et pouvoir dire à ses clients, que les messages qu'elle transfère passent par TutelLiv et par un modèle d'IA.
- **Règle de Meta sur l'IA** : à vérifier dans le texte officiel avant la mise en ligne (section 3).

## 8. Découpage en étapes livrables

| Étape | Contenu | Schéma | Vérification |
| --- | --- | --- | --- |
| 0 | Démarches Meta : compte développeur, application, numéro de test (la vérification viendra avec le SIREN) | Aucun | Message reçu sur le numéro de test |
| 1 | Webhook signé, messages texte reçus d'un numéro de l'équipe, rangés dans la liste des messages reçus | Canal sur la ligne reçue (`channel`), numéro de l'expéditeur | Tests de signature, d'équipe inconnue, de doublon ; essai réel avec un téléphone |
| 2 | Analyse, tri, « À trier », brouillon et validation (réutilisation de MAIL-PONT) | Aucun | E2E ; essai réel « Transférer » depuis WhatsApp |
| 3 | Reconnaissance du client par le téléphone ou l'e-mail lu dans le message ; carte de contact si retenue | Aucun | Tests de rapprochement |
| 4 | Message d'aide au numéro inconnu, plafonds, effacement | Aucun | Tests ; relevé du quota de messages de service |

Chaque migration passe d'abord sur `tutelliv-dev`, puis en préproduction avec ton accord demandé au début de l'étape.

## 8 bis. État au 4 novembre 2026

Décision du propriétaire : **option A maintenant, B préparée** pour basculer dès que Meta aura validé TutelLiv comme prestataire technique.

- Codé (étapes 1 à 3) : webhook signé `/api/webhooks/whatsapp`, réglage « WhatsApp » par entreprise avec la liste des numéros reconnus de l'équipe, messages rangés avec les e-mails reçus (colonne `channel`), analyse sans prendre le membre de l'équipe pour le client, client cherché par l'e-mail ou le téléphone écrits dans le message, confirmation à l'e-mail lu.
- Préparé pour B : `resolveWhatsAppTarget` est le seul endroit qui choisit l'entreprise ; un autre `phone_number_id` que celui de TutelLiv y est pour l'instant ignoré. B ajoutera une table des numéros reliés (entreprise, `phone_number_id`, jeton) et le bouton « Relier mon WhatsApp » (inscription intégrée de Meta) ; le reste ne change pas.
- Pas encore fait : message d'aide au numéro inconnu (étape 4, demande un jeton d'accès Meta), essai réel sur un téléphone.

## 9. Décisions à prendre par le propriétaire

1. **Option** : tranché le 4 novembre 2026 : A maintenant, B dès la validation de Meta.
2. **Numéro** : une nouvelle ligne dédiée (conseillé), ou un numéro existant jamais utilisé dans WhatsApp ?
3. **Carte de contact** : la proposer dès l'étape 3, ou attendre de voir si les dispatchers en ont besoin ?
4. **Calendrier** : tranché le 4 novembre 2026 : A codée tout de suite, démarches Meta (compte, vérification, prestataire technique) dès le SIREN, puis B.

## 10. Critères de fin

Un message WhatsApp transféré par un dispatcher depuis son téléphone apparaît en brouillon dans TutelLiv. Un message qui n'est pas une commande va dans « À trier ». Un numéro inconnu ne laisse aucune donnée. La validation crée la commande et, si besoin, la fiche du client. Tests, essai réel sur un vrai téléphone, `npm run check` et clic réel dans le navigateur.

## 11. Non vérifié en écrivant cette spécification

- Texte exact des conditions de Meta sur l'IA (*AI Providers*) : seule de la presse et des prestataires ont été lus.
- Disponibilité de la « coexistence » en France et pour quel type de compte.
- Plafonds sans vérification et liste française des documents acceptés : sources de prestataires seulement (Zoko, DoubleTick, Bot.space).
- Geste « Partager par e-mail » depuis WhatsApp sur iPhone et sur Android : pas encore essayé.
- Réception de messages entrants sur le numéro de test de Meta : d'après la documentation, à confirmer à l'essai.
- Montants des tarifs français : grilles de Meta non ouvertes.

Sources consultées le 4 novembre 2026 : page de tarification de Meta (developers.facebook.com/docs/whatsapp/pricing) ; référence des webhooks de Meta pour les messages texte (indicateurs `forwarded` et `frequently_forwarded`) ; TechCrunch et 9to5Mac (octobre 2025) sur la règle relative à l'IA ; guides de prestataires (360dialog, Sleekflow, Pepper Cloud, LeadSquared) sur la vérification et la coexistence.
