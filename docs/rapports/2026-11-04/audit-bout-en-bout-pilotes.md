# Audit de bout en bout avant les pilotes — 4 novembre 2026

Demande du propriétaire : utiliser TutelLiv comme un vrai utilisateur, tout regarder (fonctions et détails visuels) pour que les pilotes n'aient rien à redire sur l'existant. Audit seulement : aucun code modifié.

## Comment

- Code testé : `preproduction` au commit `31f4403`, construit en version production (`next build` puis `next start`) dans une copie isolée, sur la base de développement `tutelliv-dev` (`env2:verify-dev` vert). Aucune migration.
- 224 écrans relevés automatiquement : site public, administrateur, client, livreur (démo), dispatcher, mini-admin support, super-admin ; en ordinateur (1 280 px) et téléphone (390 px), clair et sombre. Relevés : erreurs, textes cassés, anglais, débordements, champs sans libellé.
- Relecture visuelle des 224 captures, puis vérification à la main des constats graves (code, nouvel essai, tutelliv.fr).
- Parcours cliqués de bout en bout : commande client → affectation automatique → livreur sur téléphone (prise en charge, démarrage, achats, livraison, photo + signature) → suivi client et PDF de preuve → facture → annulation tentée → support client ↔ administrateur → commande créée par l'administrateur → réaffectation manuelle → lien de suivi public → connexion avec erreurs, mot de passe oublié, formulaire de contact.
- Tests automatiques ciblés (9 fichiers) : 21 réussis, 4 échoués (expliqués plus bas), 5 ignorés.
- Preuves locales, non versionnées : `outputs/audit-2026-11-04/` (`shots/`, `flow/`, `notes.md`, `e2e.log`, `results-all.json`).

## Bloquants (à corriger avant le premier pilote)

1. **L'heure de livraison recule d'une heure à chaque « Enregistrer les modifications »** sur la fiche livraison. Prouvé : échéance 23:59, champ « Date prévue » à 22:59, enregistré sans rien toucher, puis 21:59 en base. Cause : le champ affiche l'heure UTC (`scheduledAt.slice(0, 16)`) et la relit comme heure de Paris (`new Date(scheduledAt)`). `src/features/back-office/delivery-admin-panel.tsx:58-86`. Correctif : convertir en heure de Paris à l'affichage et à l'enregistrement, avec un test.
2. **Le numéro de rue disparaît sans prévenir.** Saisie « 45 avenue des champs elysees 75008 », suggestion choisie : l'adresse devient « Avenue des Champs Élysées », sans le 45. Cela arrive quand la Base Adresse Nationale ne connaît pas le numéro. Le livreur reçoit une adresse sans numéro. Correctif : garder le numéro tapé, ou avertir et demander de confirmer.
3. **Des chiffres qui se contredisent.**
   - Sur le même tableau de bord : « En retard 3 » en haut, « En retard 2 » dans « Aujourd'hui ».
   - Une livraison faite à 22:47 n'apparaît pas dans « Livrées aujourd'hui : 0 », parce qu'elle était prévue le lendemain.
   - Relevé sur les captures : filtres de la carte « Sans livreur 0 · À démarrer 0 · En route 0 » alors que le tableau de bord indique 5 / 4 / 5 ; « Charge par livreur » à 0 avec 9 missions en cours ; alertes à 14, 13 ou 1 selon l'endroit.
   - Un patron le verra le premier jour. Correctif : une seule source de calcul et des libellés précis.
4. **La page « introuvable » est la page brute de Next.js, en anglais** (« 404 This page could not be found »), sans logo ni lien de retour, y compris en ligne. Elle s'affiche aussi pour un lien de suivi ou de commande expiré, que verront les destinataires des pilotes. Correctif : une page TutelLiv en français, avec un message propre au suivi et à la commande.
5. **Textes de développeur sur le site public**, vérifiés sur tutelliv.fr :
   - `/tarifs` : « Catalogue C11-… », « L'inscription utilise le parcours fictif déjà en place », « aucun encaissement fournisseur » ;
   - `/demonstration` : « Cette page lit seulement l'accès déjà préparé… ».
   - Correctif : réécrire en langage client.
6. **Fiche livraison côté client contradictoire** (relevé sur capture) : « Carte indisponible — aucune position enregistrée » à côté de « Signal reçu il y a 31 min » ; « Prise en charge non confirmée » alors que la livraison est « En livraison » ; deux heures prévues différentes.
7. **L'inscription `/register` commence l'étape 1 sur 5** (choix de la formule, paiement) sans dire qu'elle est fermée, alors que la page Confidentialité l'annonce fermée. Sur téléphone, le tableau des formules est en plus coupé à droite.

## Majeurs

**Fonctions et parcours**
- **« Annuler la mission » reste proposé sur une livraison déjà livrée**, avec le texte « son annulation reste possible ». Le serveur refuse bien (409, « Cette livraison est terminée »), mais l'écran ment. La confirmation est aussi une fenêtre native du navigateur, pas une fenêtre TutelLiv.
- **Un dispatcher ou un mini-admin qui ouvre une page interdite est renvoyé sans aucun message** : vers `/dispatch` ou `/support`. Il croira à une panne. Il faut un bandeau « Page réservée à l'administrateur ».
- **Nouvelle commande, côté administrateur** :
  - le choix du client est une liste native sans recherche, qui affiche des e-mails techniques ;
  - avec beaucoup de clients, cette liste devient inutilisable.
- **Nouvelle commande, côté client** :
  - après un envoi incomplet, le curseur va sur le dernier champ en erreur au lieu du premier ;
  - la notification ne cite que 3 erreurs sur 4 ;
  - « Adresse enregistrée » n'a pas de libellé lié.
- **Démonstration** :
  - Constaté : les e-mails reçus d'un essai du 3 novembre (« E2E commande urgente », « E2E à classer ») restent dans un espace de démo, car la remise à zéro ne les purge pas. Un prospect peut les voir.
  - Constaté : « Tous les espaces de démonstration sont occupés » quand plusieurs sessions tournent. Il faut vérifier la taille du pool avant les appels de prospection.
- **Livreur sur téléphone** :
  - la mission en cours et ses boutons arrivent très bas, sous 4 bandeaux ;
  - aucun bouton pour appeler le destinataire ;
  - « Échec de livraison » a le même style que « Naviguer » et lui est collé ;
  - en ouvrant la preuve, le message « Règles de votre entreprise pas encore chargées » s'affiche brièvement ;
  - la barre de démo recouvre le titre de la fenêtre de preuve.

**Mots et mentions internes montrés aux utilisateurs**
- Étape « En préparation — Préparation au centre de tri » sur chaque commande (texte figé dans `src/domains/order/order.service.ts`), alors qu'une société de livraison n'a pas de centre de tri.
- Réglages client : « si un service d'envoi est configuré sur le serveur », « opérateur type Twilio ».
- Commande par message : « non configurée », « pas encore branchée ».
- Démarrage : « Limites du pilote interne ».
- Paramètres : « Expérimental, hors offre pilote ».
- Autres : « PILOT », « (UTC) », « DOCUMENT / LINE », « mini-admins ».
- Pluriels « (s) » : « 1 nouveau(x) message(s) », « livraison(s) terminée(s) ».

**Cohérence**
- Une même livraison change de nom selon l'écran : LIV-… au dispatch, CMD-… dans Commandes.
- Les statuts changent aussi : Attente, En attente et Sans livreur ; En cours, En livraison et En cours de route ; Assigné et Assignées ; Assignée puis Livré.

**Visuel**
- La pastille flottante « Alertes » recouvre du contenu : la corbeille d'un utilisateur, des champs, le second bouton « Affecter », le champ Nom du profil livreur.
- La fiche client de l'administrateur déborde sur téléphone (427 px pour un écran de 390 px).
- Dans l'historique client, le bouton « Commander à nouveau » est coupé et sa colonne n'a pas de titre.
- Dans la liste des commandes, les en-têtes « Livraison prévue » et « Créée » se chevauchent.
- En sombre, les boutons désactivés ont l'air actifs ; en clair, leur vert pâle est peu lisible.

**Facture et preuve**
- Facture client :
  - « Émise : aujourd'hui » mais « Payée : 2 nov. » ;
  - titre « Facture d'aujourd'hui » ;
  - émetteur sans adresse ni SIRET ;
  - « Factur-X » non expliqué.
- PDF de preuve :
  - l'étiquette « Signature » chevauche le cadre ;
  - la dernière position est donnée en coordonnées GPS brutes (ici à 4 km du point de livraison, sans le dire) ;
  - l'identifiant technique s'affiche en pied de page.

**Console interne (super-admin)**
- Statuts bruts « TRIAL » et « ACTIVE ».
- Journal d'accès en codes bruts, avec un identifiant technique à la place de la personne.
- Le tableau des souscriptions déborde même sur ordinateur.
- Le badge « Bloqué » est vert.
- Des indicateurs se contredisent (79 € contre 765 €).

**Données de démonstration**
- Échéances entre minuit et 5 h.
- Presque tout est en retard.
- E-mails techniques `demo-client+session-…`.
- Des particuliers comme clients.
- « Marie Client Démo ».
- Une commande livrée avant d'avoir été créée.

## Mineurs et finition (extraits)

- Site public :
  - trois styles différents (accueil, pages marketing, connexion) : polices, pieds de page, champs ;
  - bouton bleu marine hors charte sur Contact ;
  - « 0 action / 0 action » sur l'accueil avant le clic ;
  - mentions légales provisoires (SIREN « en cours », pas d'e-mail ni de téléphone).
- Connexion :
  - « Email » et « e-mail » mélangés ;
  - « réservée à votre administrateur » au lieu de « votre transporteur » ;
  - règle des 8 caractères rappelée à la connexion.
- Typographie :
  - apostrophes droites et courbes mélangées ;
  - espaces insécables manquants ;
  - « 1000 » à côté de « 3 000 » ;
  - « 4.1 km » et « 0.00 » avec un point ;
  - téléphones non formatés ;
  - « Ex: » au lieu de « Ex. : ».
- Listes déroulantes natives mêlées aux listes stylées.
- Mauvais menu surligné (fiche livraison, carte des livreurs).
- Pagination affichée sur des pages vides.
- Avertissements de style dans la console des cartes.
- Détail complet par écran : `outputs/audit-2026-11-04/notes.md`.

## Vérifié et correct

- Double clic sans doublon : création de commande, envoi d'une demande de support, enregistrement de facture.
- Affectation automatique, puis réaffectation manuelle.
- Parcours livreur complet : prise en charge, démarrage, saisie des achats (« 12,50 » accepté), alerte « hors zone » avec confirmation, preuve avec photo, nom et signature.
- Statut « Livré » partout, PDF de preuve téléchargeable.
- Facture : une seule, 12,50 € HT + TVA = 15 €.
- Annulation d'une livraison terminée refusée par le serveur.
- Support aller-retour : le client voit la réponse.
- Lien de suivi public, sans compte.
- Connexion : messages d'erreur clairs.
- Formulaire de contact, avec son piège anti-robot invisible.
- Mot de passe oublié sur tutelliv.fr (200).
- Pages publiques en ligne en moins de 0,7 s.
- Aucune erreur JavaScript sur 224 écrans.
- Menus de chaque rôle sans entrée interdite.

## Écartés après vérification

- Pas de thème sombre sur téléphone : c'est la décision du 30 octobre (`PHONE_MEDIA_QUERY`, `src/lib/theme.ts:45`).
- Carte d'itinéraire du livreur vide : la clé IGN `DRIVE_ROUTE_IGN_URL` est absente de l'environnement local. Elle a été contrôlée en ligne le 3 novembre.
- Graphie « Tutelliv » : vient de l'environnement local. tutelliv.fr affiche bien « TutelLiv ». Seul « plateforme Tutelliv » est écrit en dur dans `src/app/(back-office)/admin/page.tsx:66` (console interne).
- Barre latérale blanche en sombre sur Facturation : non reproduite à froid.
- Mot de passe oublié « indisponible » : seulement en local, il fonctionne en ligne.

## Tests automatiques ciblés (21 réussis, 4 échoués, 5 ignorés)

- `order-intake` (2 échecs) : l'analyse IA n'est pas branchée en local. C'est l'environnement.
- `v1-operational` : le test ne choisit pas le créneau de livraison, désormais demandé (« Choisissez un créneau de livraison »). Le test est à mettre à jour ; ce n'est pas un défaut du produit.
- `public-order` (e-mails) : deux « E2E commande urgente » à cause des résidus du 3 novembre dans l'espace de démo (voir Majeurs).

## Non testé

- Invitation d'utilisateurs, ajout de client ou de livreur par l'écran : pool de démo occupé et e-mail non configuré en local.
- Commandes récurrentes.
- Analyse IA, WhatsApp, e-mails réels.
- Paiement de l'abonnement, au-delà des tests `billing`.
- Vrais téléphones : MOB-01C.
- Vitesse des pages connectées en ligne. En local, la base est loin et 6 à 12 s par page n'est pas représentatif.

## Nettoyage

- Supprimés : 2 commandes `E2E-AUDIT-1104`, 1 facture, 1 demande de support, 1 message de contact et 2 fichiers de preuve du stockage.
- Supprimés : 7 comptes de rôle (`removed: 7`).
- Serveur 3110 arrêté, port libre ; copie de travail supprimée.
- Les résidus E2E du 3 novembre dans l'espace de démo n'ont pas été touchés (ils ne viennent pas de cet audit).
