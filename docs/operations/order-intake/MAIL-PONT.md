# MAIL-PONT — Spécification de la boîte de commandes dédiée

3 novembre 2026. Rédigée par l'agent, **à relire par le propriétaire** avant tout code. Décisions sources : [C14](../../DECISIONS_PRODUIT_COMMERCIALES.md) (2 et 3 novembre 2026). Les choix encore ouverts sont rassemblés en section 9 ; rien n'est engagé tant qu'ils ne sont pas tranchés.

## 1. Objectif

Une entreprise de livraison crée une boîte réservée aux commandes (par exemple `commandes@entreprise.fr`) et la fait **renvoyer automatiquement** vers son adresse TutelLiv. TutelLiv :

1. reconnaît le vrai client (le renvoi garde l'expéditeur d'origine) ;
2. trie seul : e-mail de commande → brouillon ; autre e-mail → « À trier » ;
3. ne crée rien sans le clic du dispatcher ;
4. crée la fiche du client inconnu à la validation, sans accès à l'espace client ;
5. envoie une seule confirmation au client après la validation, au nom de l'entreprise, avec la date et le lien de suivi, « répondre à » vers la boîte de commandes.

Hors périmètre : connexion directe Gmail ou Outlook (option ultérieure, comptes Google Cloud et Azure, vérification Google et audit CASA) ; lecture des pièces jointes ; réponses suivantes dans le fil.

## 2. Ce qui existe déjà (MAIL-COMMANDE, MAIL-ECARTS)

| Élément | Où | État |
| --- | --- | --- |
| Adresse `<jeton>@<INBOUND_EMAIL_DOMAIN>` par entreprise, activable | `CompanyIntakeChannel`, [intake-channels.service.ts](../../../src/domains/public-order/intake-channels.service.ts) | En ligne |
| Webhook signé Resend, lecture du corps, plafond 200 par jour sous verrou, nettoyage des caractères | [inbound-email.service.ts](../../../src/domains/order-intake/inbound-email.service.ts) | En ligne |
| Analyse par le modèle (tâche durable `INBOUND_EMAIL`), quota 60 par heure, brouillon à valider | même fichier, `analyzeInboundEmailJob` ; [order-intake.service.ts](../../../src/domains/order-intake/order-intake.service.ts) | En ligne |
| Rapprochement du client par adresse ou téléphone de l'expéditeur | [order-intake.customer.ts](../../../src/domains/order-intake/order-intake.customer.ts), `matchCustomerBySender` | En ligne, mais ne regarde que l'expéditeur |
| Effacement du corps et du brouillon à la clôture, ligne supprimée après 30 jours | `closeInboundEmail`, `INBOUND_RETENTION_MS` | En ligne |
| Commande sans compte client (`customerId` vide, `customerEmail`) et lien de suivi invité envoyé par e-mail | modèles `Order` et `OrderTrackingLink`, [public-order.service.ts](../../../src/domains/public-order/public-order.service.ts) | En ligne pour le formulaire public |

Défauts repris de MAIL-ECARTS : client jamais retrouvé sur un e-mail transféré à la main ; « Brouillon prêt » affiché sur un e-mail qui n'est pas une commande.

## 3. Parcours de l'entreprise

1. **Paramètres → Commandes par e-mail** : l'administrateur active la réception, voit son adresse TutelLiv et saisit l'adresse de sa boîte de commandes (`commandes@entreprise.fr`). Elle sert au « répondre à » et à reconnaître les e-mails renvoyés.
2. **Guide de renvoi**, un onglet par fournisseur :
   - **Gmail / Google Workspace** : Paramètres → Transfert et POP/IMAP → Ajouter une adresse de transfert → coller l'adresse TutelLiv. Gmail envoie un code de confirmation à cette adresse : **TutelLiv l'affiche dans la page** (section 4.2). Saisir le code dans Gmail, puis choisir « Transférer une copie ».
   - **Outlook / Microsoft 365** : Règles → nouvelle règle « pour tous les messages » → **« Rediriger vers »** (pas « Transférer à », qui remplace l'expéditeur par la boîte). En Microsoft 365 professionnel, le renvoi externe est **bloqué par défaut** : l'administrateur du client doit l'autoriser dans la stratégie anti-spam sortante. Le guide le dit dès la première ligne.
   - **OVH et autres hébergeurs** : créer une redirection de `commandes@` vers l'adresse TutelLiv, en gardant une copie.
3. **Essai** : un bouton « Envoyer un e-mail d'essai » explique d'écrire depuis une autre adresse vers la boîte de commandes ; la page affiche « Renvoi reçu, expéditeur d'origine reconnu » ou l'écart constaté (section 4.3).

## 4. Réception et tri

### 4.1 Reconnaissance de l'expéditeur d'origine

Ordre de lecture, du plus fiable au moins fiable :

1. **Renvoi automatique** : l'en-tête `From` est l'expéditeur d'origine (Gmail, redirection Outlook, OVH). C'est le cas normal.
2. **Transfert à la main** (« TR : », « Fwd: ») : si `From` est la boîte de commandes elle-même ou un membre de l'équipe, lire le bloc d'en-tête cité dans le corps (`De :`, `From:`, `Envoyé par`) et en tirer l'adresse d'origine. Corrige le défaut 1 de MAIL-ECARTS.
3. Sinon : pas de client présélectionné, le dispatcher choisit.

L'expéditeur retenu est gardé à part (`originalSender`) et affiché avec sa provenance (« renvoi automatique », « lu dans l'e-mail transféré »). Un `From` peut être falsifié : la présélection n'est qu'une proposition, la validation reste humaine (section 7).

### 4.2 Code de confirmation Gmail

Un e-mail de `forwarding-noreply@google.com` dont l'objet contient « Gmail Forwarding Confirmation » ou « Confirmation de transfert Gmail » :

- n'est **pas** envoyé au modèle et ne compte pas dans le quota d'analyse ;
- prend le statut `FORWARDING_CONFIRMATION` ; la page Paramètres affiche le code à 9 chiffres et l'adresse Gmail qui demande le renvoi ;
- est effacé au bout de 24 heures ou dès que le premier e-mail renvoyé par cette adresse arrive.

Le texte exact envoyé par Gmail sera relevé lors de l'essai réel avant de figer la détection ; repli : tout e-mail de `forwarding-noreply@google.com` est traité ainsi.

### 4.3 Tri commande / autre

Pas d'appel en plus : l'analyse existante renvoie un champ `kind` (`order` ou `other`) avec une phrase de justification, dans la même réponse que le brouillon. Coût inchangé (environ 3 170 jetons en entrée et 910 en sortie mesurés le 3 novembre).

| Résultat | Statut | Écran |
| --- | --- | --- |
| `order` | `ANALYZED` | « Brouillon prêt » dans la liste des e-mails de commande |
| `other` | `NOT_ORDER` | Rangé dans « À trier » (replié), objet et expéditeur seulement ; bouton « C'est une commande » qui relance l'analyse en forçant le brouillon |
| E-mail vide ou seulement des pièces jointes | `NOT_ORDER` avec la raison « contenu en pièce jointe, non lu » | Même rangement |
| Échec de l'analyse | `ANALYSIS_FAILED` (existant) | Inchangé |

Corrige le défaut 3 de MAIL-ECARTS : « Brouillon prêt » n'apparaît que sur une commande.

## 5. Validation et fiche client

### 5.1 Validation

Inchangée sur le fond : le dispatcher ouvre le brouillon, complète, puis crée. Ajouts :

- client reconnu : présélectionné, avec la provenance de l'adresse ;
- client inconnu : formulaire « Nouveau client » prérempli (nom, adresse e-mail d'origine, téléphone et adresse lus dans l'e-mail), champs manquants signalés ; la fiche est créée **dans la même transaction** que la commande, jamais avant le clic.

### 5.2 Fiche client sans accès : point d'architecture

Contrainte trouvée dans le code : l'adresse e-mail d'un utilisateur est **unique sur toute la plateforme** (`User.email @unique`) et chaque utilisateur porte un identifiant de connexion obligatoire (`authId`). Une même société cliente servie par deux entreprises de livraison ne peut donc pas avoir deux comptes.

| Option | Principe | Pour | Contre |
| --- | --- | --- | --- |
| **A. Utilisateur sans connexion** | `User.authId` devient facultatif ; fiche = utilisateur CLIENT sans `authId` | Commandes, factures, adresses et listes existantes marchent telles quelles | Migration sur la table centrale ; une vingtaine de fichiers lisent `authId` (connexion, suppression, inscription) à revoir ; la collision d'adresse entre deux entreprises reste |
| **B. Fiche client propre à l'entreprise** (conseillée) | Nouveau modèle `CompanyCustomer` (entreprise, nom, e-mail unique **par entreprise**, téléphone, adresses, lien facultatif vers un `User` quand l'accès est donné plus tard) ; `Order` et `Invoice` gagnent `companyCustomerId` facultatif | Pas de collision entre entreprises ; aucune connexion ni siège touché ; même logique que les commandes invitées déjà en ligne | Listes de clients, facturation et export à étendre à la fiche ; plus de travail au départ |

Recommandation de l'agent : **B**, parce que la collision d'adresse rendrait A fragile dès qu'un client commande à deux transporteurs. Les clients ne sont pas comptés dans les sièges de l'abonnement (seuls livreurs, administrateurs et dispatchers le sont), donc aucune option ne change la facturation TutelLiv. Décision au propriétaire (section 9).

## 6. Confirmation au client

- Une seule, envoyée après la création de la commande, à l'expéditeur d'origine.
- Expéditeur affiché : « Nom de l'entreprise via TutelLiv » depuis l'adresse d'envoi existante ; `Reply-To` : la boîte de commandes saisie en Paramètres. L'envoi actuel ne gère pas encore `Reply-To` ([transactional-email.ts](../../../src/lib/email/transactional-email.ts)) : à ajouter.
- Contenu : référence, date prévue, lien de suivi (`OrderTrackingLink`, mécanisme invité existant), phrase « Répondez à cet e-mail pour toute question ».
- Une case « Envoyer la confirmation au client », cochée par défaut, permet de ne pas l'envoyer (client qui ne veut pas d'e-mail, commande saisie pour un tiers).
- Tâche durable avec clé unique par commande : jamais deux confirmations, même après un double clic ou une reprise.

## 7. Sécurité et données

- **Adresse TutelLiv** : jeton aléatoire déjà en place ; bouton « Changer d'adresse » qui l'invalide (à garder visible dans le guide, car il faut alors refaire le renvoi).
- **Expéditeur falsifié** : la présélection affiche « adresse non vérifiée » ; aucune commande ni confirmation sans clic ; la confirmation part à l'adresse d'origine, donc un faux expéditeur ne reçoit rien qu'il n'ait déjà.
- **Injection dans l'e-mail** : garde-fous d'INTAKE-1 inchangés (essai d'injection du 3 novembre sans effet).
- **Conservation** : corps et brouillon effacés à la clôture (existant) ; e-mails « À trier » effacés au bout de 7 jours (proposition) ; code Gmail au bout de 24 heures ; ligne supprimée après 30 jours (existant). Les durées suivent la décision DATA-02 du propriétaire.
- **Juridique** : le client doit savoir que ses e-mails de commande passent par TutelLiv (mention à ajouter au modèle de notice et au DPA, [LEGAL-1](../../legal/VERIFICATION_2026-11-02.md)). Le modèle d'IA est déjà déclaré pour INTAKE-1 (fiche F10 non qualifiée : à suivre).

## 8. Découpage en étapes livrables

Chaque étape est testée et livrable seule (petites étapes, pas de refonte).

| Étape | Contenu | Schéma | Vérification |
| --- | --- | --- | --- |
| 1 (**fait le 3 novembre**) | Tri `kind` et statut `NOT_ORDER`, rangement « À trier », bouton « C'est une commande » | Ajout d'une valeur d'énumération | Tests du tri ; E2E de la liste ; essai réel avec « Merci pour hier » |
| 2 (**fait le 3 novembre**) | Expéditeur d'origine (renvoi automatique, transfert à la main) et provenance affichée ; lecture du bloc cité seulement si l'e-mail vient d'un membre de l'équipe | Colonne `original_sender` | Tests de lecture des blocs `De :` / `From:` en français et en anglais ; essai réel |
| 3 (**fait le 3 novembre**, essai réel Gmail et Outlook à faire) | Adresse de la boîte de commandes en Paramètres, code de confirmation Gmail, guide de renvoi | Colonne `order_mailbox_address` ; valeur `FORWARDING_CONFIRMATION` | Essai réel Gmail de bout en bout ; Outlook avec redirection |
| 4 | Fiche client à la validation (option retenue en 5.2) | Selon l'option | Tests d'isolement entre entreprises ; reprise après double clic ; export DATA-02 étendu |
| 5 | Confirmation au client avec `Reply-To` | Aucun | Test d'unicité ; essai réel : réception, « répondre » arrive dans la boîte de commandes |

Chaque migration est d'abord appliquée sur `tutelliv-dev`, puis en préproduction avec l'accord demandé au début de l'étape.

## 9. Décisions à prendre par le propriétaire

1. **Fiche client** : option A ou B (section 5.2). Conseil : B.
2. **E-mails « À trier »** : garder 7 jours avec le texte, pour permettre « C'est une commande » ? Ou ne garder que l'objet et l'expéditeur, sans possibilité de rattrapage ?
3. **Nom affiché sur la confirmation** : « Entreprise via TutelLiv » (conseillé, honnête et sans réglage technique chez le client) ou seulement le nom de l'entreprise ?
4. **Ordre** : commencer par l'étape 1 (tri, utile tout de suite et sans dépendance) ? Conseil : oui, puis 2 et 3, la fiche client ensuite.

## 10. Critères de fin (repris de `TODO.md`)

Une boîte Gmail et une boîte Outlook renvoient vers TutelLiv ; le code de confirmation Gmail est visible dans TutelLiv ; le client d'origine est reconnu ; les commandes apparaissent en brouillon, les autres e-mails en « À trier » ou effacés ; la validation crée la commande et, si besoin, la fiche ; le client reçoit la confirmation avec « répondre à » vers la boîte ; tests, essai réel avec chaque fournisseur, `npm run check` et clic réel navigateur.

## 11. Non vérifié en écrivant cette spécification

- Texte exact de l'e-mail de confirmation Gmail et comportement de la redirection Outlook avec Resend : à relever à l'étape 3.
- Présence des résultats SPF et DKIM dans les données reçues de Resend : non regardé ; s'ils existent, ils remplaceront « adresse non vérifiée » par un vrai contrôle.
- Usage de `authId` compté par recherche dans le code (une vingtaine de fichiers), pas audité un par un.
