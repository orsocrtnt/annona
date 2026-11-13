# TODO Annona — application de commande et livraison B2B (boulangerie)


<!-- TODO_PROGRESS_START -->
## Progression globale

**20 tâches terminées sur 28 — 71 %**

`██████████████░░░░░░` · 8 tâches restantes

**À faire par Claude**

- Rien pour l'instant

**À faire par Orso**

- SEP-1 — Séparer complètement Annona de TutelLiv sur GitHub (après l'hébergement Annona propre (MOBILE-1) : décider du sort de `main` et `preproduction`)
- AUTH-GOOGLE — Inscription des entreprises et connexion avec Google (trancher les deux points ouverts ci-dessous, puis réglages Google Cloud et Supabase)

**À faire par Théo**

- COLLAB-1 — Travailler à deux sur le dépôt (Orso et Théo) (accepter l'invitation Supabase reçue par e-mail le 12 novembre)
- ACCES-1 — Accès et réponses du propriétaire (créneaux du premier client et volumes à deux ans (questions métier). Orso — mentions légales des factures, plus tard)
- NOTIF-1 — Notifications (mettre la clé de son compte Resend dans `.env.local` (décision d'Orso du 12 novembre), puis envoi réel d'un e-mail de test)
- MOBILE-1 — Applications iOS et Android (Capacitor) (Android sur sa machine (`cap sync`, APK de test, émulateur ou téléphone). Orso — hébergement UE, comptes Apple et Google, Firebase (liste ci-dessous), puis iOS sur son Mac après la PR Android)
- RECETTE-V1 — Recette des dix critères (réécrire `tests/e2e/v1-roles.spec.ts` et N2 (Android) ; Claude — recette finale en dernier)
- LOT1-D9 — Vérification sur téléphone et lenteur (mesure sur un vrai Android avec l'APK de MOBILE-1. Orso — relire la recette et un vrai iPhone si disponible)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 13 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge). Deux développeurs : Orso (propriétaire) et Théo ; règles du travail à deux dans `AGENTS.md`. Les tâches sont communes : « Qui » dit seulement qui doit agir ensuite._

**Répartition du 12 novembre 2026 (pour se toucher le moins possible)** : chacun a sa zone de fichiers, et un agent ne modifie pas la zone de l'autre sans le prévenir.
- Zone d'Orso : écrans et routes du back-office et du portail (`src/app/(back-office)/`, `src/app/api/dashboard/`, `src/features/` hors natif), domaines commande et tournée (`src/domains/`), `src/components/auth/`, `src/components/layouts/`, `src/app/globals.css`, `ios/` (seul Mac), `prisma/` (aucun changement de schéma prévu ; sinon annonce dans la tâche).
- Zone de Théo : mobile Android et natif (`android/`, `mobile/`, `src/lib/native/`, `public/sw.js`, `capacitor.config.ts`, `docs/MOBILE.md`), outillage du travail à deux (`scripts/collab/`), specs E2E hors lot 1 (`tests/e2e/` sauf `lot1-*`).
- Fichiers partagés, à toucher en petits commits et PR courtes : `src/lib/i18n/fr.ts` (ajouter ses textes dans la section de sa zone, jamais réordonner), `package.json` et `package-lock.json` (Théo ajoute les paquets Capacitor ; Orso n'en ajoute pas sans prévenir), `TODO.md` et l'archive (garder les deux versions en cas de conflit).

**1. Orso**
- Inscription des entreprises et connexion Google (AUTH-GOOGLE, décision du 13 novembre, écart avec PLA-02 accepté) : dire si une entreprise inscrite attend la validation du super admin et s'il y a un paiement, puis réglages Google Cloud et Supabase.
- Plus tard : mentions légales des factures (ACCES-1).
- Plus tard, après la PR Android de Théo : compilation et essai iOS sur ton Mac (MOBILE-1).
- Après l'hébergement Annona propre : décider du sort de `main` et `preproduction` (SEP-1 ; rien à faire d'ici là).

**2. Théo**
- Questions métier (décision d'Orso du 12 novembre : le métier se voit avec Théo) : créneaux du premier client et volumes à deux ans (ACCES-1).
- Mettre la clé de son compte Resend dans `.env.local`, puis envoi réel d'un e-mail de test (NOTIF-1).
- Accepter l'invitation Supabase reçue par e-mail (organisation qui contient `annona-dev`, rôle Developer, COLLAB-1).
- MOBILE-1, Android sur sa machine : `npx cap sync android`, APK de test, essai sur émulateur ou téléphone (outils déjà installés).
- RECETTE-V1 N2 : retour réseau pris en compte au bout de 15 s après un rechargement hors réseau, à revoir sur téléphone Android (`public/sw.js`, `src/lib/native/`).
- LOT1-D9 (mesure seulement) : une fois l'APK prêt, mesurer les écrans client et livreur sur un vrai Android et noter les temps dans la tâche, sans toucher au code d'Orso.
- COLLAB-2, petit défaut : hors d'une branche `<prénom>/…`, `collab:check` déduit le prénom de `git config user.name` (« orsocrtnt » chez Orso) ; faire correspondre ce nom à « orso » (détail dans l'archive, COLLAB-2).
- RECETTE-V1 (comptes de démo envoyés par Orso le 12 novembre, à ranger dans `outputs/comptes-demo.json` et `.md`) : réécrire `tests/e2e/v1-roles.spec.ts` sur les comptes du seed (il appelle `POST /api/demo/persona`, retirée) ou le supprimer, puis recettes connectées client, boulanger et livreur.
- Conseillé : installer Node 22.18 comme la CI (Node 24.22.1 installé ; les tests passent avec les deux depuis WIN-1).

**3. Claude**
- Chaque agent travaille pour son développeur, dans sa zone ci-dessus. Recette finale des dix critères (RECETTE-V1) en dernier, après MOBILE-1, NOTIF-1 et ACCES-1.

**4. Attente extérieure**
- Applications mobiles (MOBILE-1) : hébergement UE, comptes Apple Developer et Google Play, Firebase, composant iOS de Xcode ou vrais téléphones (liste ordonnée dans la tâche).

## Cadre

- Référence : `docs/cahier-des-charges/Cahier des charges - version developpeur.pdf` (identifiants CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF, à citer dans le code et les tests) et `docs/cahier-des-charges/TRI-BASE.md` (ce qu'on garde, supprime, modifie et crée).
- Décisions du 6 novembre 2026 : nom **Annona** ; applications mobiles par **Capacitor** ; tickets de support gardés pour les réclamations ; nouveau schéma Prisma propre avec une seule migration initiale ; nouvelle base.
- Branche de référence : `base`, protégée sur GitHub depuis le 10 novembre 2026 (PR obligatoire, CI verte, branche à jour). Chacun travaille sur `<prénom>/<sujet>` et pousse seulement sur demande ; jamais de push sur `preproduction` ni `main` : ils portent encore l'ancien produit.
- Base de développement : projet Supabase `annona-dev` (`fqzlfszgyeyfeshllqtj`, Paris, créé le 6 novembre 2026). L'ancienne base `tutelliv-dev` a été mise en pause pour libérer la place gratuite (réactivable depuis le tableau Supabase) ; `tutelliv-preproduction` (annona.fr) n'est pas touchée.
- L'ancienne TODO (106 tâches closes, produit coursier) reste dans l'historique git : `git show 0475b8d:TODO.md`.

## Tâches ouvertes

_Tâches closes et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **COLLAB-1 — Travailler à deux sur le dépôt (Orso et Théo).**

  **Qui : Théo — accepter l'invitation Supabase reçue par e-mail le 12 novembre.**

  - Fait : Théo (`theoner13`) collaborateur du dépôt en écriture (10 novembre) ; `base` protégée (PR obligatoire, contrôles « Contrôles sans secrets » et « Migrations sur PostgreSQL neuf », branche à jour, sans force-push) ; règles « Travail à deux » et « Branche et publication » dans `AGENTS.md` et `.cursor/rules/contexte-markdown.mdc`, listes par personne dans `npm run todo:progress`, le tout fusionné avec la PR #1, première PR sous protection, CI verte ; Théo a cloné le dépôt, rempli et vérifié `.env.local` (11 novembre) ; garde-fou de push : COLLAB-2 (archivée).
  - 12 novembre 2026 (session Claude d'Orso, Chrome) : invitation envoyée depuis le tableau Supabase (organisation « orsocrtnt's Org » › Team › Invite members, rôle Developer, adresse confirmée par Orso et volontairement non écrite ici car le dépôt est public). Tableau : « Successfully sent invitation », Théo listé « Invited » en Developer. Reste : Théo accepte l'invitation ; la tâche se coche quand il voit `annona-dev` dans son tableau Supabase. Vercel sans objet pour l'instant (seule équipe du compte : « TutelLiv », offre Hobby).
  - Note pour Théo : `DIRECT_URL` passe par le pooler, port 5432 (l'adresse directe n'est joignable qu'en IPv6).

- [ ] **SEP-1 — Séparer complètement Annona de TutelLiv sur GitHub.**

  **Qui : Orso — après l'hébergement Annona propre (MOBILE-1) : décider du sort de `main` et `preproduction`.**

  - Décision d'Orso du 12 novembre 2026 (questionnaire) : ne rien toucher à `main` ni à `preproduction` tant qu'annona.fr n'est pas rattaché à un hébergement Annona propre.

  - Demande du propriétaire (8 novembre 2026) : TutelLiv et Annona sont deux projets distincts, sans lien entre eux.
  - Fait le 8 novembre 2026 : branche par défaut du dépôt GitHub `orsocrtnt/annona` passée de `preproduction` à `base` (`gh api -X PATCH … default_branch=base` → `base`). La page du dépôt affiche désormais le README Annona. La description du dépôt (« Annona — plateforme SaaS de livraison ») ne citait déjà plus TutelLiv.
  - Liens restants constatés (non modifiés) : `main` du dépôt annona est le même commit que `main` de `orsocrtnt/tutelliv` (`af61494`) ; `preproduction` du dépôt annona porte l'ancien produit (README « # Tutelliv », 367 fichiers citant TutelLiv) ; annona.fr est servi par `tutelliv-preproduction` (Supabase). Les tâches planifiées GitHub échouent toutes les 5 min faute de secrets (aucun secret dans le dépôt annona) ; elles tournent maintenant depuis `base`, toujours sans secrets, donc sans effet.
  - Suite : décision du propriétaire sur `main` et `preproduction` (les remplacer par `base` demande un push et peut redéployer annona.fr), puis rattacher annona.fr à un projet Annona propre.

- [ ] **ACCES-1 — Accès et réponses du propriétaire.**

  **Qui : Théo — créneaux du premier client et volumes à deux ans (questions métier). Orso — mentions légales des factures, plus tard.**

  - Réponses d'Orso du 12 novembre 2026 (questionnaire) : cartographie : services gratuits (OSRM et IGN publics) pour l'instant, une solution pour 200 arrêts par jour sera chiffrée plus tard ; rappel avant l'heure limite : 15h, la valeur par défaut actuelle ; créneaux du premier client et volumes à deux ans : questions métier, à voir avec Théo ; mentions légales : plus tard ; Resend : le compte de Théo (NOTIF-1).

  - `.env.local` : fait le 6 novembre 2026 (mot de passe de la base remis à zéro et clé `service_role` collés par le propriétaire avec `remplir-env.sh`, sans passer par l'agent). Vérifié par Claude : client Prisma par le pooler `aws-1-eu-west-3` port 6543 → `select` réussi ; connexion directe (`prisma db execute`) réussie ; API d'administration Supabase avec la clé `service_role` → 200.
  - Questions ouvertes du cahier des charges (section 9) : liste des créneaux du premier client ; délai du rappel avant 17h ; volumes à deux ans ; service de cartographie (les services gratuits OSRM et IGN suffisent pour les essais, pas pour 200 arrêts par jour). En attendant, valeurs par défaut réglables : créneaux 5h-6h, 6h-7h, 7h-8h ; rappel à 15h.

  - Mentions légales des factures (FACT-1), à saisir dans les paramètres de l'entreprise ou à me donner : SIREN, n° de TVA intracommunautaire, forme juridique et capital, immatriculation RCS, taux des pénalités de retard, conditions d'escompte. Sans elles, le PDF ne les porte pas et le Factur-X est refusé.
  - Clé Resend (`RESEND_API_KEY`) pour les vrais envois d'e-mails (factures, notifications) : à coller dans `.env.local` comme les autres valeurs.

  Terminé quand : les quatre réponses, les mentions légales et la clé Resend sont fournies (`.env.local` de base déjà fait).

- [ ] **NOTIF-1 — Notifications.**

  **Qui : Théo — mettre la clé de son compte Resend dans `.env.local` (décision d'Orso du 12 novembre), puis envoi réel d'un e-mail de test.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  NOT-01 (rappel avant l'heure limite sans commande pour le lendemain, délai paramétrable), NOT-02 (confirmation à chaque commande validée ou modifiée), NOT-03 (« livreur en approche » quand l'arrêt précédent est livré).

  Terminé quand : tests des déclencheurs ; un envoi réel reçu sur une adresse de test.

  7 novembre 2026, code fait (commit `228a85a`, sans push, sans migration). NOT-01 : route `/api/cron/order-reminders` appelée par `cron-lock-orders.yml` toutes les 10 min ; client actif sans commande ni récurrente active ce jour-là, `reminderLeadMinutes` avant l'heure limite, une seule fois par compte, client et date, jamais après l'heure limite ; commande annulée ou brouillon = pas de commande ; délai 0 = rappel désactivé ; le client peut le couper (Paramètres › Alertes). NOT-02 : après chaque commande validée, modifiée ou annulée par le client et après correction admin ; au plus une confirmation toutes les 5 min par commande (la première tout de suite, les suivantes regroupées, état final relu à l'envoi). NOT-03 : au démarrage de la tournée le premier arrêt est prévenu, puis après « Livré » ou un problème le premier arrêt restant ; une seule fois par arrêt, rejeu hors ligne compris. Canaux : cloche du portail et e-mail par la file ; sans clé Resend, tâche e-mail close « ignorée » (`SKIPPED:EMAIL_DISABLED`) ; `registerNotificationChannel` prêt pour les notifications natives (MOBILE-1).
  Vérifications : 12 tests (dont changements d'heure du 25 octobre et du 29 mars, rejeu sans doublon, isolation) ; Playwright `tests/e2e/notif1-recette.spec.ts` cliqué 3/3 (confirmation dans la cloche, rappel par la route cron avec `?now=`, « livreur en approche » après un « Livré ») ; captures `outputs/recette-notif1-adm1/` ; `npm run check` 717/717 puis 731/731 ; `npm run build` vert.
  Reste : envoi réel reçu sur une adresse de test (critère de la tâche) ; confirmation différée et tâches en échec envoyées seulement au passage de `/api/cron/operations` (toutes les 5 min).

- [ ] **MOBILE-1 — Applications iOS et Android (Capacitor).**

  **Qui : Théo — Android sur sa machine (`cap sync`, APK de test, émulateur ou téléphone). Orso — hébergement UE, comptes Apple et Google, Firebase (liste ci-dessous), puis iOS sur son Mac après la PR Android.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  ENF-01 : emballer les espaces commerçant et livreur avec Capacitor ; notifications natives ; ouverture de Plans et Waze. Publication : comptes Apple Developer et Google Play à ouvrir par le propriétaire.

  Terminé quand : les deux applications s'installent sur un vrai téléphone et passent les critères 1, 7 et 8.

  7 novembre 2026, partie sans comptes ni téléphone faite (commit `789de93`, sans push, sans migration). Une seule application « Annona » (`fr.annona.app`) plutôt que deux : la connexion envoie déjà chaque compte dans son espace (client → `/portal`, livreur → `/driver`) ; une fiche par store, une revue, une clé APNs, un projet Firebase ; caméra et position demandées seulement à l'usage (deux applications restent possibles avec une seconde configuration). Mode « site hébergé » : `server.url` = `CAPACITOR_SERVER_URL`, page de repli « Pas de connexion / Réessayer » dans `mobile/www`. Projets `ios/` (Swift Package Manager) et `android/` ; textes d'autorisation en français (position « seulement pendant votre tournée », jamais « toujours »), portrait ; icônes et écrans de lancement générés depuis `public/brand`. Ponts `src/lib/native/` (comportement navigateur inchangé) : notifications natives (jeton vers `/api/native/push-token`, rangé dans `driver_push_subscriptions` avec `endpoint = native:<ios|android>:<jeton>`, canal `native_push` via `registerNotificationChannel` ; envoi APNs et FCM écrit mais inactif sans clés), caméra, position seulement pendant une tournée démarrée, Plans et Waze, réseau et retour au premier plan pour relancer la file hors ligne, nettoyage à la déconnexion. `sw.js` garde une copie de `/driver`, des données de tournée et des fichiers statiques (réseau d'abord, build de production seulement, effacée à la déconnexion). Documentation : `docs/MOBILE.md`.
  Vérifications : `tests/mobile1-native.test.ts` ; `npm run check` relancé par l'orchestrateur : 754/754 ; `npm run build` vert ; `npx cap sync` (8 extensions iOS et Android) ; Playwright `tour1-recette` et `cat1-cmd1-recette` 8/8 (recopie 32,3 s) ; aucun dossier lourd versionné (vérifié). Compilation iOS en échec sur ce Mac : Xcode 26.6 refuse toute destination iOS (« iOS 26.5 is not installed ») et le catalogue d'images de l'extension caméra exige un simulateur ; `AppDelegate.swift` et `SceneDelegate.swift` passent `swiftc -typecheck`. Android non compilé sur ce Mac (ni SDK ni Java). Caches créés hors du dépôt, supprimables : frameworks Capacitor et Cordova téléchargés avec curl depuis leur source officielle (empreintes vérifiées) dans `~/Library/Caches/org.swift.swiftpm/artifacts/`, et `~/Library/Developer/Xcode/DerivedData/App-*`.
  Reste au propriétaire, dans l'ordre : (1) hébergement UE et adresse HTTPS définitive, puis `CAPACITOR_SERVER_URL=<adresse> npm run mobile:sync` ; (2) compte Apple Developer (équipe de signature, capacité « Push Notifications », clé APNs `.p8` dans `APNS_*`) ; (3) compte Google Play Console ; (4) projet Firebase (`android/app/google-services.json` hors git, compte de service dans `FCM_*`, puis `NEXT_PUBLIC_NATIVE_PUSH=on`) ; (5) composant iOS dans Xcode (Réglages › Composants) et Android Studio, ou un vrai iPhone et un vrai Android ; puis Claude relance `npm run mobile:build:ios` et teste les critères 1, 7 et 8 sur téléphone ; (6) `WKAppBoundDomains` avec le domaine de production pour la copie hors réseau dans l'application iPhone.
  Douteux : Apple peut refuser une application qui charge un site (règle 4.2 ; les fonctions natives sont l'argument) ; `getPhoto` déprécié dans l'extension caméra 8 ; sur Android, « Plans » ouvre la carte web d'Apple ; la table `driver_push_subscriptions` porte aussi les jetons des clients ; copie hors réseau non essayée sur un build de production.
  11 novembre 2026, machine Windows de Théo : JDK Temurin 21 et SDK Android en ligne de commande (plateforme 36, build-tools 36, platform-tools) installés dans `%LOCALAPPDATA%` (`AnnonaTools/jdk-21`, `Android/Sdk`), licences du SDK acceptées ; `android/local.properties` pointe sur ce SDK (fichier ignoré par git). Premier `gradlew assembleDebug` en échec attendu : `capacitor-cordova-android-plugins/cordova.variables.gradle` absent, il faut d'abord `npx cap sync android`. Reste (Claude, sur la machine de Théo) : `cap sync`, APK de test, essai sur émulateur ou téléphone ; notifications natives inactives sans Firebase.

- [ ] **RECETTE-V1 — Recette des dix critères.**

  **Qui : Théo — réécrire `tests/e2e/v1-roles.spec.ts` et N2 (Android) ; Claude — recette finale en dernier.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  Rejouer les dix critères de la section 10 du cahier des charges sur `annona-dev`, dans le navigateur, avec un rapport et des captures.

  Terminé quand : les dix critères passent et le rapport est dans `docs/rapports/`.

  - 7 novembre 2026 : les dix critères passent dans le navigateur, sur un build de production local (rapport `docs/rapports/2026-11-07-recette-v1-navigateur.md`, spec `tests/e2e/recette-v1.spec.ts` 12/12). Défauts trouvés et retours du propriétaire des 10 et 11 novembre : corrigés, détail dans `docs/TODO-ARCHIVE.md` (journal du 11 novembre).
  - Reste : critères 1, 7, 8 et notifications natives sur vrais téléphones (après MOBILE-1) ; e-mails réels (clé Resend, NOTIF-1) ; mentions légales des factures (ACCES-1).
  - Défauts encore ouverts : N2 (mineur) retour réseau pris en compte au bout de 15 s après un rechargement hors réseau, à revoir sur téléphone.
  - N1, reste « arrêt remis en attente par l'admin pendant l'état « sent » » : constaté le 12 novembre 2026 (session Claude d'Orso) que l'application n'offre aucune action qui remette un arrêt en attente (écritures de `stop` côté admin : ordre et tournée seulement, `round-admin.service.ts`, `admin-order.service.ts` ; statut changé seulement par le livreur, `round-driver.service.ts`). Le cas n'arrive que par une modification directe en base : rien à recetter dans le navigateur ; la règle reste couverte par `settleSentDriverActions` et son test (`tests/tour1-rounds.test.ts`). À rouvrir si une action « annuler la livraison » est ajoutée.
  - Décision N3 (proposée par Théo le 11 novembre, **validée par Orso le 12 novembre 2026**) : l'outre-mer n'est pas en V1 ; « Aujourd'hui » reste calculé à l'heure de Paris côté boulanger et admin. À rouvrir si une boulangerie d'outre-mer arrive.
  - Décision tournées (proposée par Théo le 11 novembre, **validée par Orso le 12 novembre 2026**) : avant de désactiver une tournée qui coupe des clients de la commande, avertir sans bloquer (« Désactiver quand même », `src/features/settings/zone-deactivation.ts`, PR #6).
  - À faire : `tests/e2e/v1-roles.spec.ts` appelle encore `POST /api/demo/persona`, retirée : le réécrire sur les comptes du seed ou le supprimer.
  - À refaire à la prochaine recette : admin › tableau de bord, changer de page aussitôt, console sans erreur (correction `getZoom`, prouvée sur banc d'essai mais non reproduite dans l'admin).

- [ ] **AUTH-GOOGLE — Inscription des entreprises et connexion avec Google.**

  **Qui : Orso — trancher les deux points ouverts ci-dessous, puis réglages Google Cloud et Supabase.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  Demande d'Orso du 13 novembre 2026 : ajouter la connexion avec un compte Google. Constat du même jour : aucune connexion Google dans le code (`src/`), seules les notifications natives parlent à Google. Zone d'Orso (`src/components/auth/`).

  Création de compte aujourd'hui (constat du 13 novembre) : aucune inscription libre. L'admin d'une entreprise crée les comptes de ses clients et employés (`createUserByAdmin`, `src/domains/user/user.service.ts`), le super admin crée l'admin d'une nouvelle entreprise (`src/domains/admin/company-admin.service.ts`). Invitation Supabase par e-mail (ou compte en attente sans mot de passe si `AUTH_EMAIL_LINKS_ENABLED` n'est pas à `true`), puis la personne choisit son mot de passe. Un compte Supabase sans profil Annona est refusé à la connexion (`UserNotProvisionedError`).

  Décision d'Orso du 13 novembre 2026 :
  - Inscription ouverte seulement aux entreprises : une entreprise crée elle-même son compte et son compte admin, par e-mail ou avec Google.
  - Les comptes des clients et des employés (boulanger, livreur, mini admin) restent créés par l'admin de l'entreprise, comme aujourd'hui ; aucune inscription libre pour eux.
  - Ces comptes peuvent se connecter avec Google, sur le compte créé par l'admin (même adresse e-mail). Une adresse Google sans compte créé par un admin n'ouvre aucun accès.

  Écart avec le cahier des charges : PLA-02 dit que le super admin crée, configure et suspend les entreprises ; `TRI-BASE.md` a retiré l'inscription autonome de l'ancien produit (« c'est l'éditeur qui ouvre les comptes »). L'ancien parcours TutelLiv reste lisible dans l'historique (`git show 0475b8d:src/domains/signup/signup.service.ts`, `src/app/(auth)/register/page.tsx`, `src/app/api/auth/register/route.ts`), avec paiement. **Écart accepté par Orso le 13 novembre 2026** (après lecture de PLA-02, ADM-01, CLI-01 et PLA-05) : « on ne va pas gérer les inscriptions de tout le monde ». Seules les entreprises s'inscrivent seules ; les commerçants restent créés par l'admin de leur entreprise (ADM-01). La connexion Google s'ajoute à l'e-mail et au mot de passe (CLI-01), sans les remplacer.

  Points ouverts, à trancher par Orso avant de coder : (1) une entreprise inscrite est-elle active tout de suite ou après validation par le super admin ; (2) paiement à l'inscription ou non. Réglages : identifiants OAuth dans Google Cloud, fournisseur Google activé dans Supabase (`annona-dev`), adresses de retour (local, hébergement définitif, applications mobiles de MOBILE-1).

  Terminé quand : une entreprise s'inscrit (e-mail et Google) et arrive dans son espace admin ; un compte créé par l'admin se connecte avec Google ; une adresse Google inconnue est refusée ; isolation entre entreprises vérifiée (PLA-01) ; tests du parcours.

### Lot 1 de demandes de modification (Théo Nerisson, 10 novembre 2026)

_D1 à D9 codées, migrées sur `annona-dev`, recettées dans Chrome (Playwright) le 10 novembre au soir et fusionnées dans `base` (PR #1). D1 à D8 et la recette validées par Orso le 12 novembre 2026, puis archivées ; reste D9 (vrais téléphones). Notes pour la suite : D4 — TutelLiv rangeait les modules du mini admin dans `User.settings.miniAdmin.modules` et filtrait les permissions à la lecture (`filterMiniAdminPermissions`, `git show 0475b8d:src/lib/permissions/mini-admin.ts`) ; la liste des tournées (`GET /api/company/zones`) exige `settings:read`, à ouvrir aussi à `merchants:read` pour un mini admin « comptes » sans « paramètres ». D5 — `DriverLocation` (dernière position, `updatedAt`) et `/api/maps/route` existent déjà ; TutelLiv avait `deliveries-live-map.tsx` (`git show 0475b8d:src/components/maps/deliveries-live-map.tsx`). D9 — mesurer « avant » avant toute correction de lenteur. Appliquer les migrations : passer par le pooler en mode session (port 5432 de `DATABASE_URL`), la connexion directe `db.…supabase.co` est injoignable d'ici. Rejouer la recette : serveur de production sur le port 3110 (`next build`, puis `next start`), `npx dotenv -e .env.local -- npx tsx scripts/e2e/lot1-d5-round-fixture.ts` (avant minuit heure de Paris), puis `E2E_BASE_URL=http://localhost:3110 E2E_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx dotenv -e .env.local -- npx playwright test tests/e2e/lot1-recette.spec.ts --workers=1` (`CLEAN_DELETE=1 … -g CLEAN` supprime les comptes `e2e-`), et finir par `npm run db:seed`._

_Source : `outputs/retouche/Demandes de modification - lot 1.pdf` (9 demandes, ordre imposé : 1, puis 8, 7, 6, 3, puis 2, 4, puis 5, puis 9). Branche `orso/lot1-retouches`, un commit par demande, fusionnée dans `base` (PR #1). Migrations du lot appliquées sur `annona-dev` le 10 novembre ; toute nouvelle migration ou seed s'annonce d'abord dans sa tâche (`AGENTS.md`)._

- [ ] **LOT1-D9 — Vérification sur téléphone et lenteur.**

  **Qui : Théo — mesure sur un vrai Android avec l'APK de MOBILE-1. Orso — relire la recette et un vrai iPhone si disponible.**

  - 12 novembre 2026 (session Claude d'Orso, branche `orso/d9-tableau-de-bord`) : tableau de bord admin (ADM-04, ADM-08) ramené de quatre vagues de lectures successives à deux. L'entreprise (fuseau, dépôt) vient du compte déjà lu par le garde (`liveCompanyFrom`, relecture si un champ manque ou si l'entreprise n'est pas la bonne) ; lignes et commerces des commandes du jour sont lus en même temps que les arrêts (`readStopSources`, `loadStopDetails(…, preloadedSources)`), contenu inchangé. Tests `tests/lot1-d9-live-dashboard.test.ts` (5 : deux vagues, même contenu qu'avant, entreprise étrangère ignorée, jour sans tournée, garde de type) ; `tests/tour1-rounds.test.ts` inchangé et vert ; `npm run check` sortie 0, 832 tests, 831 réussis, 1 sauté ; `next build` sortie 0. Mesure réelle (version de production sur `annona-dev`, profil téléphone 4G de la spec, `E2E_PERF_ACCOUNTS=admin`, nouveau filtre de la spec) : tableau de bord 3,0 / 2,5 / 2,5 s, **médiane 2,5 s** (3,3 s le 10 novembre) ; écrans témoins non touchés du même ordre qu'alors (Commandes 2,8 / 2,5 / 2,1 s ; Tournées 2,6 / 2,1 / 2,0 s), donc base pas plus rapide ce jour-là. Les 13 écrans de l'administrateur sont sous 3 s, sans débordement. Résultats bruts `outputs/perf/d9-admin-apres-{1,2,3}.json`. Reste : vrais téléphones.
  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : Décision d'Orso appliquée (`cb442e1`). Deuxième mesure avec les écrans du lot 1 : médianes 2,1 s à l'ouverture, 1,0 s en navigation, 25/26 écrans sous 3 s (tableau de bord admin 3,3 s), aucun débordement ; gain propre à la décision non isolé (base plus rapide ce soir-là). Reste : vrais iPhone et Android.

  - 10 novembre 2026 (commit `80133da` sur `orso/lot1-retouches`, sans push). Compte rendu : `docs/rapports/2026-11-10-lot1-d9-telephone-lenteur.md`. Mesure rejouable `tests/e2e/lot1-d9-perf.spec.ts` (téléphone 360 px, 4G simulée, processeur ×4 ; « ouverture » à cache vide et « navigation » dans l'application), avant/après sur la version d'avant le lot (`65aadfa`, seule compatible avec la base non migrée) construite en production. Médianes : ouverture 5,8 s → 3,2 s, navigation 3,2 s → 1,8 s ; écrans sous 3 s : 2/24 → 11/24 à l'ouverture, 10/20 → 17/20 en navigation ; aucun débordement horizontal à 360 px.
  - Corrections : compte, entreprise, rôle et permissions relus en une requête SQL au lieu de quatre requêtes successives (`getUserByAuthId`, objet identique vérifié sur les 11 comptes de démo d'`annona-dev`) ; verrou du jour et liste des commandes admin : lectures indépendantes en parallèle ; deux cibles tactiles trop petites (nom du client dans la liste, liens des mentions légales manquantes).
  - Écart expliqué : serveur local à 0,52 s par aller-retour vers la base (quelques ms en production, `cdg1` et `eu-west-3`) ; les écrans encore au-dessus de 3 s (Commandes, Tournées, Tableau de bord, Production, Ma tournée à l'ouverture, Mes commandes) sont ceux qui enchaînent le plus de lectures.
  - 10 novembre 2026, décision d'Orso (« je t'autorise à tout ») : `RoleGuard` affiche la page du portail client et du livreur et lance ses requêtes sans attendre la session du navigateur ; une fois la session connue, un autre rôle ou une session absente redirige comme avant (`roleGuardShowsPage`, `src/components/auth/role-guard.tsx`). Commit `cb442e1`. Vérifications : `tests/lot1-d9-role-guard.test.ts` (2 tests) ; `npm run check` sortie 0, 805/805 ; `next build` sortie 0. Non vérifié : effet mesuré (mesure des écrans à refaire), rechargement réel dans le navigateur (LOT1-RECETTE).
  - Non fait : mesure contre un déploiement Vercel ; vrais iPhone et Android (aucun appareil). Écrans du lot 1 mesurés à la recette du soir.
  - Vérifications : `tests/lot1-d9-auth-query.test.ts` (conversion des colonnes et des dates, une seule requête) ; tests existants adaptés (`account-access`, `auth-role-real-guard`) ; `npm run check` sortie 0, 803/803 ; `next build` sortie 0.

