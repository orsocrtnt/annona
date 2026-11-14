# TODO Annona — application de commande et livraison B2B (boulangerie)


<!-- TODO_PROGRESS_START -->
## Progression globale

**22 tâches terminées sur 30 — 73 %**

`███████████████░░░░░` · 8 tâches restantes

**Qui a fait quoi**

| | Orso | Théo |
|---|---|---|
| Fait | **20** : NOTIF-1, COLLAB-1, LOT1-D1, LOT1-D8, LOT1-D7, LOT1-D6, LOT1-D3, LOT1-D2, LOT1-D4, LOT1-D5, LOT1-RECETTE, ADM-1, FACT-1, TOUR-1, BOU-1, LOCK-1, CMD-1, CAT-1, SCHEMA-1, NET-1 | **4** : NOTIF-1, COLLAB-1, COLLAB-2, WIN-1 |
| À faire | **4** : DEMO-1, SEP-1, ACCES-1, AUTH-GOOGLE | **4** : MOBILE-1, RECETTE-V1, HEB-1, LOT1-D9 |

**À faire par Claude**

- Rien pour l'instant

**À faire par Orso**

- DEMO-1 — Version de démo d'Annona, comme celle de TutelLiv
- SEP-1 — Séparer complètement Annona de TutelLiv sur GitHub (après l'hébergement Annona propre (MOBILE-1) : décider du sort de `main` et `preproduction`)
- ACCES-1 — Accès et réponses du propriétaire (mentions légales des factures, plus tard (questions métier de Théo répondues le 13 novembre))
- AUTH-GOOGLE — Inscription des entreprises et connexion avec Google (brancher le SMTP Resend de `annona-dev` (tableau Supabase, `docs/AUTH_EMAIL_SETUP.md`) pour l'inscription par e-mail ; ensuite Claude fait l'inscription par e-mail et la vérification d'isolation (PLA-01) et clôt la tâche)

**À faire par Théo**

- HEB-1 — Héberger Annona sur Vercel (compte Vercel de Théo)
- MOBILE-1 — Applications iOS et Android (Capacitor) (APK sur un vrai téléphone Android (critères 1, 7, 8, N2, LOT1-D9). Orso — hébergement UE, comptes Apple et Google, Firebase (liste ci-dessous), puis iOS sur son Mac après la PR Android)
- RECETTE-V1 — Recette des dix critères (N2 et critères 1, 7, 8 sur Android (après MOBILE-1) ; Claude — recette finale en dernier)
- LOT1-D9 — Vérification sur téléphone et lenteur (mesure sur un vrai Android avec l'APK de MOBILE-1. Orso — relire la recette et un vrai iPhone si disponible)

_Une tâche faite à deux compte pour chacun. Chaque tâche ouverte est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 13 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge). Deux développeurs : Orso (propriétaire) et Théo ; règles du travail à deux dans `AGENTS.md`. Les tâches sont communes : « Qui » dit seulement qui doit agir ensuite._

**Répartition du 12 novembre 2026 (pour se toucher le moins possible)** : chacun a sa zone de fichiers, et un agent ne modifie pas la zone de l'autre sans le prévenir.
- Zone d'Orso : écrans et routes du back-office et du portail (`src/app/(back-office)/`, `src/app/api/dashboard/`, `src/features/` hors natif), domaines commande et tournée (`src/domains/`), `src/components/auth/`, `src/components/layouts/`, `src/app/globals.css`, `ios/` (seul Mac), `prisma/` (aucun changement de schéma prévu ; sinon annonce dans la tâche).
- Zone de Théo : mobile Android et natif (`android/`, `mobile/`, `src/lib/native/`, `public/sw.js`, `capacitor.config.ts`, `docs/MOBILE.md`), outillage du travail à deux (`scripts/collab/`), specs E2E hors lot 1 (`tests/e2e/` sauf `lot1-*`).
- Fichiers partagés, à toucher en petits commits et PR courtes : `src/lib/i18n/fr.ts` (ajouter ses textes dans la section de sa zone, jamais réordonner), `package.json` et `package-lock.json` (Théo ajoute les paquets Capacitor ; Orso n'en ajoute pas sans prévenir), `TODO.md` et l'archive (garder les deux versions en cas de conflit).

**1. Orso**
- AUTH-GOOGLE : inscription avec Google essayée en vrai et réussie le 13 novembre (boulangerie « TEST 1 » sur `annona-dev`). Pour l'essayer en local : `NEXT_PUBLIC_GOOGLE_AUTH=on` dans `.env.local`, port 3000.
- Version de démo d'Annona comme celle de TutelLiv (DEMO-1).
- Relire deux corrections de Théo dans ta zone (LOT1-D9, 14 novembre) : support plateforme du super-admin réparé (`relatedDelivery`), et la liste des gains de vitesse restants côté admin (relecture de session à chaque écran, icônes redemandées, préchargements en double).
- Tournées : relever `ROUND_MAX_STOPS` (30, `src/domains/order/round-generation.ts`) à 110 au minimum, un livreur = une tournée (réponses métier de Théo du 13 novembre, ACCES-1). Vérifier aussi que 110 arrêts tiennent dans la durée de la plage (110 × 3 min ≈ 5h30 plus les trajets, plage du matin de 7h).
- Plus tard : mentions légales des factures (ACCES-1).
- Plus tard, après la PR Android de Théo : compilation et essai iOS sur ton Mac (MOBILE-1).
- Après l'hébergement Annona propre : décider du sort de `main` et `preproduction` (SEP-1 ; rien à faire d'ici là).

**2. Théo**
- Héberger Annona sur Vercel, sur ton compte Vercel (HEB-1, demande d'Orso du 13 novembre) : projet depuis `orsocrtnt/annona`, branche `base`, variables de `.env.example` ; base à décider avec Orso ; puis brancher l'adresse dans Supabase, Google et MOBILE-1.
- AUTH-GOOGLE : fait le 13 novembre (adresse inconnue refusée, compte créé par l'admin connecté avec Google, passé « Actif »). Plus rien pour toi ; reste le SMTP côté Orso.
- Questions métier (ACCES-1) : répondues le 13 novembre (plages matin 5h30-12h30 et après-midi 15h-19h ; 60-70 arrêts par livreur, 15-20 produits par livraison ; 200 points par jour au plus ; un livreur = une tournée, au moins 110 points).
- MOBILE-1, Android : essayé sur émulateur puis sur un vrai Galaxy (Samsung Remote Test Lab, tunnel temporaire) le 14 novembre, « ça marche ». Reste à noter ce qui a été testé (critères 1, 7, 8) et les temps pour LOT1-D9 ; iOS et notifications côté Orso.
- RECETTE-V1 N2 : retour réseau pris en compte au bout de 15 s après un rechargement hors réseau, à revoir sur téléphone Android (`public/sw.js`, `src/lib/native/`).
- LOT1-D9 (mesure seulement) : une fois l'APK prêt, mesurer les écrans client et livreur sur un vrai Android et noter les temps dans la tâche, sans toucher au code d'Orso.
- RECETTE-V1 : `v1-roles.spec.ts` verte (4 rôles) et recette cliquée des quatre espaces 33/33 le 14 novembre (rapport `docs/rapports/2026-11-14-recette-roles-theo.md`). Reste N2 et les critères téléphone après l'APK (MOBILE-1).
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

- [ ] **DEMO-1 — Version de démo d'Annona, comme celle de TutelLiv.**

  **Qui : Orso.**

  - Demande d'Orso (13 novembre 2026) : refaire pour Annona la démo qu'avait TutelLiv.
  - Ce qu'avait TutelLiv (ancienne TODO, `git show 0475b8d:TODO.md`) : bouton « Voir la démo » qui ouvre un espace de démo sans identifiants (`/demo`) ; démo remise à l'heure à l'ouverture et racontant une journée lisible (DEMO-REFONTE) ; suivi des démos par le super admin sur `/admin/demos` avec « Remettre à neuf » et « Tout remettre à neuf » (DEMO-LIVE).
  - À préciser avec Orso avant de coder : quels espaces montrer (client, boulanger, livreur), quelle journée type de boulangerie (voir Théo pour le métier), et sur quelle base (pas `annona-dev`, partagée avec Théo).

- [ ] **SEP-1 — Séparer complètement Annona de TutelLiv sur GitHub.**

  **Qui : Orso — après l'hébergement Annona propre (MOBILE-1) : décider du sort de `main` et `preproduction`.**

  - Décision d'Orso du 12 novembre 2026 (questionnaire) : ne rien toucher à `main` ni à `preproduction` tant qu'annona.fr n'est pas rattaché à un hébergement Annona propre.

  - Demande du propriétaire (8 novembre 2026) : TutelLiv et Annona sont deux projets distincts, sans lien entre eux.
  - Fait le 8 novembre 2026 : branche par défaut du dépôt GitHub `orsocrtnt/annona` passée de `preproduction` à `base` (`gh api -X PATCH … default_branch=base` → `base`). La page du dépôt affiche désormais le README Annona. La description du dépôt (« Annona — plateforme SaaS de livraison ») ne citait déjà plus TutelLiv.
  - Liens restants constatés (non modifiés) : `main` du dépôt annona est le même commit que `main` de `orsocrtnt/tutelliv` (`af61494`) ; `preproduction` du dépôt annona porte l'ancien produit (README « # Tutelliv », 367 fichiers citant TutelLiv) ; annona.fr est servi par `tutelliv-preproduction` (Supabase). Les tâches planifiées GitHub échouent toutes les 5 min faute de secrets (aucun secret dans le dépôt annona) ; elles tournent maintenant depuis `base`, toujours sans secrets, donc sans effet.
  - Suite : décision du propriétaire sur `main` et `preproduction` (les remplacer par `base` demande un push et peut redéployer annona.fr), puis rattacher annona.fr à un projet Annona propre.

- [ ] **ACCES-1 — Accès et réponses du propriétaire.**

  **Qui : Orso — mentions légales des factures, plus tard (questions métier de Théo répondues le 13 novembre).**

  - Réponses de Théo du 13 novembre 2026 (questions métier) : livraison par plage horaire, en deux tournées : **matin de 5h30 à 12h30**, **après-midi de 15h à 19h**. Par livreur : **60 à 70 points de livraison** en moyenne par tournée, **15 à 20 produits** par livraison.
  - Contrôle du code par Claude (13 novembre) : les deux plages sont acceptées par les tournées du lot 1 (`delivery-zone.service.ts`, le soir commence après le matin) ; 15 à 20 produits restent loin de `MAX_ORDER_LINES` (300). **Écart** : `ROUND_MAX_STOPS = 30` (`src/domains/order/round-generation.ts`) coupe en deux ou trois tournées un livreur à 60-70 arrêts ; à relever vers 70 (ou rendre réglable) par Orso, zone `src/domains/`. Durée : 65 arrêts × 3 min (`ROUND_STOP_SECONDS`) ≈ 3h15 plus les trajets, compatible avec la plage du matin. Les zones de démo du seed (5h30-11h, 16h-19h) diffèrent de ces plages : sans effet sur le code, à aligner si Orso le souhaite.
  - Complément de Théo (13 novembre) : **jamais plus de 200 points de livraison par jour** en tout (sous le seuil noté par Orso pour la cartographie) ; **un livreur = une tournée**, et une tournée doit pouvoir compter **au moins 110 points**. Donc `ROUND_MAX_STOPS` (30) doit passer à 110 au minimum, et la génération ne doit pas couper la charge d'un livreur en plusieurs tournées.

  - Réponses d'Orso du 12 novembre 2026 (questionnaire) : cartographie : services gratuits (OSRM et IGN publics) pour l'instant, une solution pour 200 arrêts par jour sera chiffrée plus tard ; rappel avant l'heure limite : 15h, la valeur par défaut actuelle ; créneaux du premier client et volumes à deux ans : questions métier, à voir avec Théo ; mentions légales : plus tard ; Resend : le compte de Théo (NOTIF-1).

  - `.env.local` : fait le 6 novembre 2026 (mot de passe de la base remis à zéro et clé `service_role` collés par le propriétaire avec `remplir-env.sh`, sans passer par l'agent). Vérifié par Claude : client Prisma par le pooler `aws-1-eu-west-3` port 6543 → `select` réussi ; connexion directe (`prisma db execute`) réussie ; API d'administration Supabase avec la clé `service_role` → 200.
  - Questions ouvertes du cahier des charges (section 9) : liste des créneaux du premier client ; délai du rappel avant 17h ; volumes à deux ans ; service de cartographie (les services gratuits OSRM et IGN suffisent pour les essais, pas pour 200 arrêts par jour). En attendant, valeurs par défaut réglables : créneaux 5h-6h, 6h-7h, 7h-8h ; rappel à 15h.

  - Mentions légales des factures (FACT-1), à saisir dans les paramètres de l'entreprise ou à me donner : SIREN, n° de TVA intracommunautaire, forme juridique et capital, immatriculation RCS, taux des pénalités de retard, conditions d'escompte. Sans elles, le PDF ne les porte pas et le Factur-X est refusé.
  - Clé Resend (`RESEND_API_KEY`) pour les vrais envois d'e-mails (factures, notifications) : à coller dans `.env.local` comme les autres valeurs.

  Terminé quand : les quatre réponses, les mentions légales et la clé Resend sont fournies (`.env.local` de base déjà fait).

- [ ] **MOBILE-1 — Applications iOS et Android (Capacitor).**

  **Qui : Théo — APK sur un vrai téléphone Android (critères 1, 7, 8, N2, LOT1-D9). Orso — hébergement UE, comptes Apple et Google, Firebase (liste ci-dessous), puis iOS sur son Mac après la PR Android.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  - 13 novembre 2026 (poste Windows de Théo) : `CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync android` réussi (8 modules natifs, aucun fichier suivi modifié). Erreur de constat corrigée le 14 novembre : Java était bien installé (JDK Temurin 21 dans `%LOCALAPPDATA%/AnnonaTools/jdk-21`, voir la note du 11 novembre), seul l'émulateur manquait.
  - 14 novembre 2026 : `JAVA_HOME=%LOCALAPPDATA%/AnnonaTools/jdk-21 ./gradlew assembleDebug --no-daemon` → **BUILD SUCCESSFUL** en 7 min (338 tâches), `android/app/build/outputs/apk/debug/app-debug.apk` (10,6 Mo, dossier ignoré par git), adresse chargée `http://10.0.2.2:3000` (émulateur). Poste : virtualisation activée, hyperviseur présent, 15 Go de RAM. Émulateur et image `system-images;android-36;google_apis;x86_64` installés (`sdkmanager`, un premier téléchargement coupé puis repris), téléphone virtuel `annona-pixel` (Pixel 7, Android 16), accélération WHPX utilisable, démarrage en ~65 s, `adb install` → Success.
  - Essai dans l'application (vue web pilotée par le protocole Chrome DevTools) : première tentative refusée « Origine de la requête refusée » (SEC-6, `src/lib/security/origin-check.ts`) car l'émulateur appelait `http://10.0.2.2:3000` alors que l'origine admise est `http://localhost:3000`. Sans toucher à la sécurité : `adb reverse tcp:3000 tcp:3000`, `cap sync` avec l'adresse par défaut `http://localhost:3000`, APK recompilé. Ensuite : livreur-1 connecté → « Ma tournée » puis « Profil » ; client-1 connecté → « Commander » (prix spécifique affiché) ; **0 erreur JavaScript** ; bouton Google masqué dans l'application (voulu). Captures `outputs/mobile1-android/`. Procédure ajoutée dans `docs/MOBILE.md` (« Essai Android sans Android Studio », et `10.0.2.2` retiré des conseils). En production l'application charge l'adresse officielle : pas de refus.
  - Au passage : `tests/e2e/v1-roles.spec.ts` appelait `POST /api/auth/logout`, route inexistante (404 ignoré) ; appel retiré (chaque test a déjà son navigateur vierge). Relancée 5/5 ; `npm run check` sortie 0 (841 tests, 834 réussis, 0 échec) ; `npm run docs:verify` vert.
  - 14 novembre 2026 (nuit), **vrai téléphone Android** : Galaxy de Samsung Remote Test Lab (service gratuit, compte développeur Samsung de Théo). APK de debug recompilé avec `CAPACITOR_SERVER_URL` = tunnel Cloudflare temporaire (`cloudflared tunnel --url http://localhost:3000`, adresse `trycloudflare.com` aléatoire) et serveur dev relancé avec `NEXT_PUBLIC_APP_URL` = cette adresse (sinon refus SEC-6) ; connexion livreur vérifiée par le tunnel avant envoi. Théo a installé l'APK sur le Galaxy et rapporte : « j'ai tout testé, ça marche sur Android ». Détail non consigné (modèle, parcours, critères 1, 7, 8, temps de LOT1-D9) : à demander à Théo. Tunnel fermé et serveur relancé sans l'adresse du tunnel juste après ; `cap sync` remis sur `http://localhost:3000`, aucun fichier suivi modifié, APK « tunnel » supprimé.
  - Non vérifié : notifications natives (Firebase absent), iOS (Mac d'Orso).

  ENF-01 : emballer les espaces commerçant et livreur avec Capacitor ; notifications natives ; ouverture de Plans et Waze. Publication : comptes Apple Developer et Google Play à ouvrir par le propriétaire.

  Terminé quand : les deux applications s'installent sur un vrai téléphone et passent les critères 1, 7 et 8.

  7 novembre 2026, partie sans comptes ni téléphone faite (commit `789de93`, sans push, sans migration). Une seule application « Annona » (`fr.annona.app`) plutôt que deux : la connexion envoie déjà chaque compte dans son espace (client → `/portal`, livreur → `/driver`) ; une fiche par store, une revue, une clé APNs, un projet Firebase ; caméra et position demandées seulement à l'usage (deux applications restent possibles avec une seconde configuration). Mode « site hébergé » : `server.url` = `CAPACITOR_SERVER_URL`, page de repli « Pas de connexion / Réessayer » dans `mobile/www`. Projets `ios/` (Swift Package Manager) et `android/` ; textes d'autorisation en français (position « seulement pendant votre tournée », jamais « toujours »), portrait ; icônes et écrans de lancement générés depuis `public/brand`. Ponts `src/lib/native/` (comportement navigateur inchangé) : notifications natives (jeton vers `/api/native/push-token`, rangé dans `driver_push_subscriptions` avec `endpoint = native:<ios|android>:<jeton>`, canal `native_push` via `registerNotificationChannel` ; envoi APNs et FCM écrit mais inactif sans clés), caméra, position seulement pendant une tournée démarrée, Plans et Waze, réseau et retour au premier plan pour relancer la file hors ligne, nettoyage à la déconnexion. `sw.js` garde une copie de `/driver`, des données de tournée et des fichiers statiques (réseau d'abord, build de production seulement, effacée à la déconnexion). Documentation : `docs/MOBILE.md`.
  Vérifications : `tests/mobile1-native.test.ts` ; `npm run check` relancé par l'orchestrateur : 754/754 ; `npm run build` vert ; `npx cap sync` (8 extensions iOS et Android) ; Playwright `tour1-recette` et `cat1-cmd1-recette` 8/8 (recopie 32,3 s) ; aucun dossier lourd versionné (vérifié). Compilation iOS en échec sur ce Mac : Xcode 26.6 refuse toute destination iOS (« iOS 26.5 is not installed ») et le catalogue d'images de l'extension caméra exige un simulateur ; `AppDelegate.swift` et `SceneDelegate.swift` passent `swiftc -typecheck`. Android non compilé sur ce Mac (ni SDK ni Java). Caches créés hors du dépôt, supprimables : frameworks Capacitor et Cordova téléchargés avec curl depuis leur source officielle (empreintes vérifiées) dans `~/Library/Caches/org.swift.swiftpm/artifacts/`, et `~/Library/Developer/Xcode/DerivedData/App-*`.
  Reste au propriétaire, dans l'ordre : (1) hébergement UE et adresse HTTPS définitive (Vercel sur le compte de Théo, HEB-1), puis `CAPACITOR_SERVER_URL=<adresse> npm run mobile:sync` ; (2) compte Apple Developer (équipe de signature, capacité « Push Notifications », clé APNs `.p8` dans `APNS_*`) ; (3) compte Google Play Console ; (4) projet Firebase (`android/app/google-services.json` hors git, compte de service dans `FCM_*`, puis `NEXT_PUBLIC_NATIVE_PUSH=on`) ; (5) composant iOS dans Xcode (Réglages › Composants) et Android Studio, ou un vrai iPhone et un vrai Android ; puis Claude relance `npm run mobile:build:ios` et teste les critères 1, 7 et 8 sur téléphone ; (6) `WKAppBoundDomains` avec le domaine de production pour la copie hors réseau dans l'application iPhone.

  AUTH-GOOGLE (13 novembre 2026, pour Théo, sa zone) : le bouton « Continuer avec Google » est masqué dans les applications (`isNativeApp()`, `src/features/auth/google-button.tsx`) car Google refuse sa page de connexion dans la vue web de Capacitor. Version appli à faire : ouvrir Google dans le navigateur du système (`@capacitor/browser`), revenir dans l'application par un lien profond vers `/auth/callback`, ajouter ce lien aux Redirect URLs Supabase.
  Douteux : Apple peut refuser une application qui charge un site (règle 4.2 ; les fonctions natives sont l'argument) ; `getPhoto` déprécié dans l'extension caméra 8 ; sur Android, « Plans » ouvre la carte web d'Apple ; la table `driver_push_subscriptions` porte aussi les jetons des clients ; copie hors réseau non essayée sur un build de production.
  11 novembre 2026, machine Windows de Théo : JDK Temurin 21 et SDK Android en ligne de commande (plateforme 36, build-tools 36, platform-tools) installés dans `%LOCALAPPDATA%` (`AnnonaTools/jdk-21`, `Android/Sdk`), licences du SDK acceptées ; `android/local.properties` pointe sur ce SDK (fichier ignoré par git). Premier `gradlew assembleDebug` en échec attendu : `capacitor-cordova-android-plugins/cordova.variables.gradle` absent, il faut d'abord `npx cap sync android`. Reste (Claude, sur la machine de Théo) : `cap sync`, APK de test, essai sur émulateur ou téléphone ; notifications natives inactives sans Firebase.

- [ ] **RECETTE-V1 — Recette des dix critères.**

  **Qui : Théo — N2 et critères 1, 7, 8 sur Android (après MOBILE-1) ; Claude — recette finale en dernier.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  Rejouer les dix critères de la section 10 du cahier des charges sur `annona-dev`, dans le navigateur, avec un rapport et des captures.

  Terminé quand : les dix critères passent et le rapport est dans `docs/rapports/`.

  - 7 novembre 2026 : les dix critères passent dans le navigateur, sur un build de production local (rapport `docs/rapports/2026-11-07-recette-v1-navigateur.md`, spec `tests/e2e/recette-v1.spec.ts` 12/12). Défauts trouvés et retours du propriétaire des 10 et 11 novembre : corrigés, détail dans `docs/TODO-ARCHIVE.md` (journal du 11 novembre).
  - Reste : critères 1, 7, 8 et notifications natives sur vrais téléphones (après MOBILE-1) ; e-mails réels faits (NOTIF-1 close le 13 novembre) ; mentions légales des factures (ACCES-1).
  - Défauts encore ouverts : N2 (mineur) retour réseau pris en compte au bout de 15 s après un rechargement hors réseau, à revoir sur téléphone.
  - N1, reste « arrêt remis en attente par l'admin pendant l'état « sent » » : constaté le 12 novembre 2026 (session Claude d'Orso) que l'application n'offre aucune action qui remette un arrêt en attente (écritures de `stop` côté admin : ordre et tournée seulement, `round-admin.service.ts`, `admin-order.service.ts` ; statut changé seulement par le livreur, `round-driver.service.ts`). Le cas n'arrive que par une modification directe en base : rien à recetter dans le navigateur ; la règle reste couverte par `settleSentDriverActions` et son test (`tests/tour1-rounds.test.ts`). À rouvrir si une action « annuler la livraison » est ajoutée.
  - Décision N3 (proposée par Théo le 11 novembre, **validée par Orso le 12 novembre 2026**) : l'outre-mer n'est pas en V1 ; « Aujourd'hui » reste calculé à l'heure de Paris côté boulanger et admin. À rouvrir si une boulangerie d'outre-mer arrive.
  - Décision tournées (proposée par Théo le 11 novembre, **validée par Orso le 12 novembre 2026**) : avant de désactiver une tournée qui coupe des clients de la commande, avertir sans bloquer (« Désactiver quand même », `src/features/settings/zone-deactivation.ts`, PR #6).
  - 13 novembre 2026 (session Claude de Théo, branche `theo/collab-nom-git`) : `tests/e2e/v1-roles.spec.ts` réécrite. Un test par rôle (admin, boulanger, client-1, livreur-1) : connexion par l'écran du rôle, espace sans erreur JavaScript, API du rôle en 200, API des trois autres rôles en 403 ; plus un test sans session (401 partout). Rien n'est écrit en base : `/api/orders` et `/api/production` sont lus à J+30 (avant l'heure limite, pas de verrouillage LOCK-1, vérifié dans `ensureDateLocked`). Comptes lus dans `outputs/comptes-demo.json`, rôle sauté si absent.
  - Vérifié (serveur dev de Théo, port 3000, `annona-dev`) : admin et sans session réussis (2/2), boulanger, client et livreur sautés car `outputs/comptes-demo.json` ne contient que `admin` (connexion de ce compte OK par Supabase Auth). `npm run check` sortie 0 (841 tests, 834 réussis, 0 échec). Chromium de Playwright installé sur le poste de Théo. Note du skill `annona-recette` mise à jour.
  - 13 novembre 2026, suite : les 12 comptes envoyés par Orso le 12 novembre rangés dans `outputs/comptes-demo.json` (format du seed : e-mail, mot de passe, rôle, espace) et `outputs/comptes-demo.md`, ignorés par git ; mot de passe `admin` identique à l'ancien fichier. Connexion Supabase Auth des 12 comptes : 12/12. `v1-roles.spec.ts` relancée (serveur dev de Théo, port 3000) : **5/5 réussis** (admin, boulanger, client-1, livreur-1 : espace, API du rôle 200, API des trois autres 403 ; sans session 401), en 1 min.
  - 14 novembre 2026 (session Claude de Théo, commit `54b9a80`, `annona-dev`, serveur dev port 3000) : recette cliquée des quatre espaces, **33/33 étapes, zéro erreur console**, rapport `docs/rapports/2026-11-14-recette-roles-theo.md`, captures `outputs/recette-agents/theo-roles/`. Admin (menu complet, carte en direct), client (six pages, détail de commande, retour arrière, rechargement), boulanger (production à J+30, refus du back-office), livreur (tournée, profil, refus du portail) ; sombre vérifié sur ordinateur et tablette (sur téléphone le clair est la règle, `src/lib/theme.ts:37`). Rien écrit en base. Aucun défaut.
  - Reste : N2 et critères 1, 7, 8 sur vrai téléphone Android (après MOBILE-1), puis recette finale.
  - Fait le 14 novembre 2026 : admin › tableau de bord puis « Commandes » aussitôt, console sans erreur (correction `getZoom` vérifiée dans l'admin, rapport du 14 novembre).

- [ ] **HEB-1 — Héberger Annona sur Vercel (compte Vercel de Théo).**

  **Qui : Théo.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  Demande d'Orso du 13 novembre 2026 : Théo héberge Annona sur Vercel, sur son propre compte Vercel. C'est l'« hébergement Annona propre » attendu par MOBILE-1 (adresse HTTPS définitive), AUTH-GOOGLE (adresse de retour Google) et SEP-1 (sort de `main` et `preproduction`).

  Déjà dans le dépôt : `vercel.json` (région `cdg1`, Paris : données traitées dans l'UE ; tâches planifiées `lock-orders` et `billing`, une fois par jour) ; variables à renseigner listées dans `.env.example`.

  Étapes :
  1. Sur le compte Vercel de Théo : nouveau projet importé depuis le dépôt GitHub `orsocrtnt/annona`, branche de production `base` (jamais `main` ni `preproduction`, qui portent l'ancien produit).
  2. Variables d'environnement du projet : celles de `.env.example` (Supabase, `DATABASE_URL` et `DIRECT_URL`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` = l'adresse Vercel, etc.). Base à utiliser (`annona-dev` ou une base de production séparée) : à décider avec Orso avant le premier déploiement.
  3. Premier déploiement, puis vérifier la connexion et un écran par rôle sur l'adresse Vercel.
  4. Brancher l'adresse obtenue : Supabase › URL Configuration (Site URL et Redirect URLs `https://<adresse>/**`) ; Google Cloud `annona-514617` › client « Annona dev » (origine `https://<adresse>`) et `NEXT_PUBLIC_GOOGLE_AUTH=on` sur Vercel (AUTH-GOOGLE) ; `CAPACITOR_SERVER_URL=<adresse> npm run mobile:sync` (MOBILE-1).
  5. Plus tard : rattacher annona.fr (aujourd'hui servi par l'ancien projet TutelLiv, voir SEP-1), avec l'accord d'Orso.

  À vérifier avant de choisir l'offre Vercel : l'offre gratuite (Hobby) est réservée à un usage non commercial selon les conditions de Vercel ; l'offre Pro est payante.

  Terminé quand : Annona tourne sur l'adresse Vercel du compte de Théo, depuis `base`, avec connexion et écrans vérifiés, et l'adresse est notée ici et dans MOBILE-1.

- [ ] **AUTH-GOOGLE — Inscription des entreprises et connexion avec Google.**

  **Qui : Orso — brancher le SMTP Resend de `annona-dev` (tableau Supabase, `docs/AUTH_EMAIL_SETUP.md`) pour l'inscription par e-mail ; ensuite Claude fait l'inscription par e-mail et la vérification d'isolation (PLA-01) et clôt la tâche.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  Demande d'Orso du 13 novembre 2026 : ajouter la connexion avec un compte Google. Constat du même jour : aucune connexion Google dans le code (`src/`), seules les notifications natives parlent à Google. Zone d'Orso (`src/components/auth/`).

  Création de compte aujourd'hui (constat du 13 novembre) : aucune inscription libre. L'admin d'une entreprise crée les comptes de ses clients et employés (`createUserByAdmin`, `src/domains/user/user.service.ts`), le super admin crée l'admin d'une nouvelle entreprise (`src/domains/admin/company-admin.service.ts`). Invitation Supabase par e-mail (ou compte en attente sans mot de passe si `AUTH_EMAIL_LINKS_ENABLED` n'est pas à `true`), puis la personne choisit son mot de passe. Un compte Supabase sans profil Annona est refusé à la connexion (`UserNotProvisionedError`).

  Décision d'Orso du 13 novembre 2026 :
  - Inscription ouverte seulement aux entreprises : une entreprise crée elle-même son compte et son compte admin, par e-mail ou avec Google.
  - Les comptes des clients et des employés (boulanger, livreur, mini admin) restent créés par l'admin de l'entreprise, comme aujourd'hui ; aucune inscription libre pour eux.
  - Ces comptes peuvent se connecter avec Google, sur le compte créé par l'admin (même adresse e-mail). Une adresse Google sans compte créé par un admin n'ouvre aucun accès.

  Écart avec le cahier des charges : PLA-02 dit que le super admin crée, configure et suspend les entreprises ; `TRI-BASE.md` a retiré l'inscription autonome de l'ancien produit (« c'est l'éditeur qui ouvre les comptes »). L'ancien parcours TutelLiv reste lisible dans l'historique (`git show 0475b8d:src/domains/signup/signup.service.ts`, `src/app/(auth)/register/page.tsx`, `src/app/api/auth/register/route.ts`), avec paiement. **Écart accepté par Orso le 13 novembre 2026** (après lecture de PLA-02, ADM-01, CLI-01 et PLA-05) : « on ne va pas gérer les inscriptions de tout le monde ». Seules les entreprises s'inscrivent seules ; les commerçants restent créés par l'admin de leur entreprise (ADM-01). La connexion Google s'ajoute à l'e-mail et au mot de passe (CLI-01), sans les remplacer.

  Questionnaire d'Orso du 13 novembre 2026 (réponses) : entreprise inscrite au statut « Essai » (même accès qu'active ; plus tard, active après paiement Stripe, PLA-05) ; formulaire minimal (nom de la boulangerie, prénom, nom, e-mail, mot de passe ou Google ; le reste dans Paramètres) ; arrivée sur le tableau de bord ; phrase et lien vers `/confidentialite` (pas de CGU) ; pas d'alerte, liste des entreprises du super admin ; compte « en attente » créé par l'admin activé à la première connexion Google de même adresse ; Google sur le web seulement (bouton masqué dans les applications, version appli pour Théo dans MOBILE-1) ; Google Cloud en mode Test, testeur : l'adresse Google d'Orso (Théo s'ajoutera) ; e-mail de confirmation réel plus tard (SMTP Resend de `annona-dev`) ; essai réel autorisé dans le Chrome d'Orso. Projet Google Cloud créé : `annona-514617`.

  Anciens points ouverts, tranchés ci-dessus : (1) une entreprise inscrite est-elle active tout de suite ou après validation par le super admin ; (2) paiement à l'inscription ou non. Réglages : identifiants OAuth dans Google Cloud, fournisseur Google activé dans Supabase (`annona-dev`), adresses de retour (local, hébergement définitif, applications mobiles de MOBILE-1).

  13 novembre 2026 (session Claude d'Orso, branche `orso/auth-google`), code fait :
  - `/inscription` : Google, ou e-mail + mot de passe (nom de la boulangerie, prénom, nom). Entreprise « Essai » (TRIAL), trois créneaux de départ, 17h, heure de Paris ; admin « en attente » jusqu'au lien de confirmation (e-mail) ou actif tout de suite (Google). Réponse identique que l'adresse soit libre ou non. Services `src/domains/auth/company-signup.service.ts` (+ `supabase-signup.ts`), création commune avec le super admin (`insertCompanyWithAdmin`, `src/domains/admin/company-admin.service.ts`), routes `POST /api/auth/signup` et `/api/auth/signup/google` (adresse relue dans la session Supabase, jamais dans la requête).
  - `/auth/callback` : retour de Google et du lien de confirmation ; profil relu en base ; compte « en attente » activé si l'adresse est prouvée (`syncUserFromSupabase(…, { activatePending })`, aussi à la connexion par mot de passe une fois l'adresse confirmée) ; profil « en attente » resté sur un autre compte de connexion rattaché au compte Google (`adoptPendingProfile`) ; adresse inconnue : déconnexion, compte de connexion né de Google retiré (sinon il bloquerait la création du compte par un admin), message sur `/login` avec lien vers l'inscription.
  - Bouton « Continuer avec Google » sur `/login`, `/login/client`, `/login/driver` et `/inscription`, affiché seulement avec `NEXT_PUBLIC_GOOGLE_AUTH=on` et hors applications natives ; lien « Vous êtes une boulangerie ? Créer votre compte » sur `/login`.
  - Vérifications : `tests/auth-google-signup.test.ts` (8 tests) ; listes fermées mises à jour (`tests/adm1-criterion10-isolation.test.ts`, `tests/auth-role-page-access.test.ts`) ; `npm run check` sortie 0 (840 tests, 839 réussis, 1 sauté) ; `next build` sortie 0. Captures Playwright à 360 px et 1280 px de `/inscription`, des erreurs du formulaire, de `/login?google=inconnu` et de `/login/client` : aucun débordement. Inscription par e-mail réelle sur `annona-dev` : refus propre « L'e-mail de confirmation n'a pas pu être envoyé… » (502, SMTP Supabase non branché), rien créé (vérifié en base : ni entreprise, ni profil, ni compte de connexion).
  - Supabase `annona-dev` (Chrome) : Redirect URLs `http://localhost:3000/**` et `http://localhost:3110/**` ajoutées (Site URL inchangée, `http://localhost:3000`). Inscriptions et confirmation d'e-mail déjà actives.
  - Google Cloud (Chrome, compte Google d'Orso) : projet `annona-514617` créé ; écran de connexion rempli (nom « Annona », e-mail d'assistance du compte, type Externe, contact) mais **pas créé** : la case d'acceptation du règlement Google sur les données utilisateur a été refusée à Claude par le garde-fou de sécurité, à cocher par Orso. Claude ne saisit pas non plus le code secret du client OAuth dans Supabase.

  13 novembre 2026 (soir), réglages faits et essai réel réussi (Chrome d'Orso, `next dev` sur le port 3000, `NEXT_PUBLIC_GOOGLE_AUTH=on` dans `.env.local`) : Orso a coché le règlement Google et créé le client OAuth « Annona dev » (origine `http://localhost:3000`, retour `https://fqzlfszgyeyfeshllqtj.supabase.co/auth/v1/callback`), puis activé Google dans Supabase `annona-dev` avec l'ID et le code secret. Testeurs Google (mode Test) : Orso et Théo (adresses non écrites ici, dépôt public). Parcours : `/inscription` › « Continuer avec Google » › choix du compte chez Google › `/inscription?etape=entreprise` (prénom et nom pré-remplis par Google) › « TEST 1 » › « Créer mon espace » › `/dashboard` admin. Vérifié en base : entreprise « TEST 1 » (`test-1`) au statut TRIAL, 3 créneaux, admin ACTIVE relié à un compte de connexion d'identité `google`. L'entreprise « TEST 1 » reste sur `annona-dev` pour les essais suivants. Pas encore essayé en vrai : connexion Google d'un compte créé par l'admin, refus d'une adresse inconnue (couverts par les tests), inscription par e-mail avec vrai e-mail (SMTP).

  Étapes faites le 13 novembre (gardées pour l'hébergement définitif) :
  1. Google Cloud › projet `annona-514617` › Google Auth Platform › Présentation › « Premiers pas » : nom « Annona », e-mail d'assistance = ton adresse, Cible « Externe », coordonnées = ton adresse, cocher le règlement, « Créer ».
  2. Google Auth Platform › Audience › Utilisateurs de test › ajouter ton adresse Google (mode Test).
  3. Google Auth Platform › Clients › « Créer un client » : type « Application Web », nom « Annona dev » ; Origines JavaScript autorisées : `http://localhost:3000` ; URI de redirection autorisés : `https://fqzlfszgyeyfeshllqtj.supabase.co/auth/v1/callback`. Garder l'ID client et le code secret affichés.
  4. Supabase › `annona-dev` › Authentication › Sign In / Providers › Google : activer, coller l'ID client et le code secret, « Save ».
  5. Dire à Claude « Google est réglé » : Claude met `NEXT_PUBLIC_GOOGLE_AUTH=on` dans `.env.local`, fait l'essai réel dans ton Chrome (inscription d'une boulangerie de test, connexion d'un compte créé par l'admin, adresse inconnue refusée) et note le résultat ici.
  Plus tard : branchement SMTP Resend de `annona-dev` pour le vrai e-mail de confirmation (`docs/AUTH_EMAIL_SETUP.md`) ; Théo s'ajoute comme testeur (Audience › Utilisateurs de test, ou accès au projet Google Cloud donné par Orso) ; hébergement définitif : ajouter son adresse dans les Redirect URLs Supabase, les origines Google et `NEXT_PUBLIC_GOOGLE_AUTH=on` sur l'hébergeur ; paiement Stripe avant activation (PLA-05).

  13 novembre 2026 (nuit), essai de Théo (son Chrome, `next dev` relancé par Claude sur le port 3000 avec `NEXT_PUBLIC_GOOGLE_AUTH=on` ajouté à son `.env.local`), dans l'ordre :
  1. Adresse Google de Théo (testeur) sans compte Annona : `/login/driver` › « Continuer avec Google » → refus affiché « Aucun compte Annona pour cette adresse Google… l'administrateur doit d'abord créer votre compte avec cette adresse. » **OK.**
  2. Admin de démo (`demo-admin`), vrais clics Playwright dans `/users` › « Inviter un utilisateur » : « Test-theo Google », rôle Livreur, adresse Google de Théo → `POST /api/users` 201, statut « Invité » (`PENDING_VERIFICATION`), aucun e-mail (`AUTH_EMAIL_LINKS_ENABLED=false`), 0 erreur JavaScript ; capture `outputs/theo-recette/auth-google-creation.png`.
  3. Théo se reconnecte avec Google → espace livreur (« Ma tournée » vide, « Profil » à compléter). **OK.** Base relue : un seul compte à cette adresse, `ACTIVE`, `DRIVER`, entreprise `demo_company_boulangerie`, compte de connexion Google rattaché.
  Compte de test gardé pour les prochains essais Google (adresse de Théo, prénom « Test-theo »). Reste pour clore : inscription par e-mail (bloquée tant que le SMTP de `annona-dev` n'est pas branché, refus propre 502 constaté par Orso), vérification d'isolation PLA-01 sur l'entreprise inscrite, tests du parcours.

  Terminé quand : une entreprise s'inscrit (e-mail et Google) et arrive dans son espace admin ; un compte créé par l'admin se connecte avec Google ; une adresse Google inconnue est refusée ; isolation entre entreprises vérifiée (PLA-01) ; tests du parcours.

### Lot 1 de demandes de modification (Théo Nerisson, 10 novembre 2026)

_D1 à D9 codées, migrées sur `annona-dev`, recettées dans Chrome (Playwright) le 10 novembre au soir et fusionnées dans `base` (PR #1). D1 à D8 et la recette validées par Orso le 12 novembre 2026, puis archivées ; reste D9 (vrais téléphones). Notes pour la suite : D4 — TutelLiv rangeait les modules du mini admin dans `User.settings.miniAdmin.modules` et filtrait les permissions à la lecture (`filterMiniAdminPermissions`, `git show 0475b8d:src/lib/permissions/mini-admin.ts`) ; la liste des tournées (`GET /api/company/zones`) exige `settings:read`, à ouvrir aussi à `merchants:read` pour un mini admin « comptes » sans « paramètres ». D5 — `DriverLocation` (dernière position, `updatedAt`) et `/api/maps/route` existent déjà ; TutelLiv avait `deliveries-live-map.tsx` (`git show 0475b8d:src/components/maps/deliveries-live-map.tsx`). D9 — mesurer « avant » avant toute correction de lenteur. Appliquer les migrations : passer par le pooler en mode session (port 5432 de `DATABASE_URL`), la connexion directe `db.…supabase.co` est injoignable d'ici. Rejouer la recette : serveur de production sur le port 3110 (`next build`, puis `next start`), `npx dotenv -e .env.local -- npx tsx scripts/e2e/lot1-d5-round-fixture.ts` (avant minuit heure de Paris), puis `E2E_BASE_URL=http://localhost:3110 E2E_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx dotenv -e .env.local -- npx playwright test tests/e2e/lot1-recette.spec.ts --workers=1` (`CLEAN_DELETE=1 … -g CLEAN` supprime les comptes `e2e-`), et finir par `npm run db:seed`._

_Source : `outputs/retouche/Demandes de modification - lot 1.pdf` (9 demandes, ordre imposé : 1, puis 8, 7, 6, 3, puis 2, 4, puis 5, puis 9). Branche `orso/lot1-retouches`, un commit par demande, fusionnée dans `base` (PR #1). Migrations du lot appliquées sur `annona-dev` le 10 novembre ; toute nouvelle migration ou seed s'annonce d'abord dans sa tâche (`AGENTS.md`)._

- [ ] **LOT1-D9 — Vérification sur téléphone et lenteur.**

  **Qui : Théo — mesure sur un vrai Android avec l'APK de MOBILE-1. Orso — relire la recette et un vrai iPhone si disponible.**

  - 14 novembre 2026 (session Claude de Théo) : mesure des **12 comptes de démo dans l'application Android** (émulateur Pixel 7, Android 16, APK de debug, `adb reverse`), sur un **build de production** local (`npm run build` vert, `next start` port 3000), vue web pilotée par le protocole Chrome DevTools ; « prêt » = bon écran, titre affiché et plus aucun appel serveur en vol. Résultats bruts `outputs/mobile1-android/perf/avant.json`. Les 12 comptes se connectent et arrivent dans leur espace, **0 erreur JavaScript**. Connexion complète 3,1 à 7 s (dont `POST /api/auth/login` 1,3 s) ; changement d'onglet 1,2 à 2,6 s au back-office et au portail, 15 à 400 ms chez le livreur ; plancher d'environ 400 ms par appel API (médianes : `/api/orders` 970 ms, `/api/driver/rounds` 960 ms, `/api/production` 930 ms, `/api/portal/orders` 830 ms, `/api/auth/session` 270 ms à chaque navigation).
  - Cause principale de ces temps sur le poste de Théo : **NordVPN actif** (interface `NordLynx`, DNS `103.86.96.100`) ; un aller-retour `select 1` vers le pooler Supabase `eu-west-3` coûte 137 ms (médiane, 15 essais), Supabase Auth 270 ms. Un appel API enchaîne 3 à 4 allers-retours : ces mesures surestiment fortement la production, où le serveur est à côté de la base. Conséquence pour HEB-1 : héberger dans la même région que la base (Paris, `cdg1` chez Vercel).
  - **Défaut trouvé** (zone d'Orso) : super-admin › « Support plateforme » affiche toujours « Tickets indisponibles ». `GET /api/admin/support-tickets` → 500 `PrismaClientValidationError` : `src/domains/admin/support-tickets.service.ts:124` sélectionne `relatedDelivery`, champ de l'ancien produit absent du modèle `SupportTicket` (aussi `:45`, `:136`, la colonne de `src/app/(back-office)/admin/support/page.tsx:131` et `tests/admin01-support*.test.ts`, dont le mock masque l'erreur).
  - Suite du 14 novembre, VPN coupé par Théo : aller-retour base 86 ms (au lieu de 137). Décomposition d'un changement d'écran (protocole Chrome DevTools, toutes requêtes) : les fichiers `/_next/static` de l'écran mettaient 0,7 à 1,1 s sans aucun octet réseau, retenus par le service worker du livreur (`public/sw.js`, zone de Théo), actif aussi sur le portail et le back-office une fois installé : réseau d'abord, puis rangement et tri de toute la copie (300 entrées) **avant** de rendre le fichier ; et à chaque connexion livreur, la liste envoyée par l'écran faisait retélécharger et retrier chaque fichier, ce qui bloquait la session et la tournée (livreur à 13 s, un échec de connexion).
  - **Corrigé dans `public/sw.js`** : fichiers `/_next/static` (nom unique par version, contenu immuable) servis depuis la copie d'abord, sinon réponse rendue tout de suite et rangement en arrière-plan (`waitUntil`) ; tri de la copie au plus toutes les 30 s ; fichier déjà copié jamais retéléchargé depuis la liste de connexion. Inchangé : réseau d'abord pour les écrans `/driver`, la tournée et la session (copie hors réseau signalée, N1). Tests : `tests/mobile1-native.test.ts` (nouveau test LOT1-D9 : copie servie sans réseau, réponse avant la fin du rangement, pas de nouveau téléchargement), 36/36 avec `driver-push`.
  - **Corrigé, zone d'Orso, à relire par lui** : support plateforme du super-admin (`relatedDelivery` retiré de `src/domains/admin/support-tickets.service.ts`, sélection typée `satisfies Prisma.SupportTicketSelect` pour qu'un champ disparu casse la vérification des types ; colonne « Livraison » retirée de `src/app/(back-office)/admin/support/page.tsx` ; tests mis à jour et nouveau test qui confronte la sélection au modèle `SupportTicket` du schéma). Vérifié dans l'application : « Support plateforme » s'ouvre en 1,1 s.
  - Mesure finale (build de production recompilé, 12 comptes dans l'application, `outputs/mobile1-android/perf/apres.json`) : fichiers JavaScript d'un écran ~100 ms au lieu de 0,7 à 1,1 s. Livreurs : connexion 2,6 à 3,0 s (avant 3,4 à 5 s), tournée 0,6 s en médiane (avant 0,96 s), profil 0,3 à 0,6 s, deux passes de plus sans échec. Clients : Factures 0,86 à 0,95 s (avant 1,65 à 1,85 s), Récurrente 1,05 s (1,4), Commandes 0,93 à 1,3 s (1,1 à 1,4), Paramètres 1,25 s (1,9). Super-admin : support réparé. Admin : 1,1 à 1,8 s par onglet, peu changé. 0 erreur JavaScript. Une partie du gain vient de la coupure du VPN ; le gain propre au service worker se lit sur les fichiers JavaScript. Incidents isolés non reproduits : un profil livreur à 14,9 s (puis 0,31 et 0,33 s), le catalogue admin resté sur son squelette une fois (puis 2,35 s et 0,73 s).
  - `npm run build` vert (deux fois), `npm run check` sortie 0 (843 tests, 836 réussis, 0 échec), `npm run docs:verify` vert.
  - **Reste, zone d'Orso (gains suivants, non faits)** : (1) admin : `useAccessRefresh` (`src/hooks/use-access-refresh.ts`, demande 4 du lot 1) relit `/api/auth/session` à chaque changement d'écran et les données de l'écran attendent sa réponse (300 à 850 ms par onglet) : la lancer en parallèle ou la limiter au mini admin ; (2) `favicon.ico` et `icon.png` redemandés 8 fois à chaque changement d'écran ; (3) préchargements en double de Next (`/settings/billing` 10 fois, chaque fiche client deux fois depuis la liste) : `prefetch={false}` sur les liens de lignes de tableau ; (4) `POST /api/auth/login` ~0,9 s ; (5) `/login` rendu à la demande et 282 Ko de JavaScript ; (6) HEB-1 dans la région de la base (Paris).

  - 12 novembre 2026 (session Claude d'Orso, branche `orso/d9-tableau-de-bord`) : tableau de bord admin (ADM-04, ADM-08) ramené de quatre vagues de lectures successives à deux. L'entreprise (fuseau, dépôt) vient du compte déjà lu par le garde (`liveCompanyFrom`, relecture si un champ manque ou si l'entreprise n'est pas la bonne) ; lignes et commerces des commandes du jour sont lus en même temps que les arrêts (`readStopSources`, `loadStopDetails(…, preloadedSources)`), contenu inchangé. Tests `tests/lot1-d9-live-dashboard.test.ts` (5 : deux vagues, même contenu qu'avant, entreprise étrangère ignorée, jour sans tournée, garde de type) ; `tests/tour1-rounds.test.ts` inchangé et vert ; `npm run check` sortie 0, 832 tests, 831 réussis, 1 sauté ; `next build` sortie 0. Mesure réelle (version de production sur `annona-dev`, profil téléphone 4G de la spec, `E2E_PERF_ACCOUNTS=admin`, nouveau filtre de la spec) : tableau de bord 3,0 / 2,5 / 2,5 s, **médiane 2,5 s** (3,3 s le 10 novembre) ; écrans témoins non touchés du même ordre qu'alors (Commandes 2,8 / 2,5 / 2,1 s ; Tournées 2,6 / 2,1 / 2,0 s), donc base pas plus rapide ce jour-là. Les 13 écrans de l'administrateur sont sous 3 s, sans débordement. Résultats bruts `outputs/perf/d9-admin-apres-{1,2,3}.json`. Reste : vrais téléphones.
  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : Décision d'Orso appliquée (`cb442e1`). Deuxième mesure avec les écrans du lot 1 : médianes 2,1 s à l'ouverture, 1,0 s en navigation, 25/26 écrans sous 3 s (tableau de bord admin 3,3 s), aucun débordement ; gain propre à la décision non isolé (base plus rapide ce soir-là). Reste : vrais iPhone et Android.

  - 10 novembre 2026 (commit `80133da` sur `orso/lot1-retouches`, sans push). Compte rendu : `docs/rapports/2026-11-10-lot1-d9-telephone-lenteur.md`. Mesure rejouable `tests/e2e/lot1-d9-perf.spec.ts` (téléphone 360 px, 4G simulée, processeur ×4 ; « ouverture » à cache vide et « navigation » dans l'application), avant/après sur la version d'avant le lot (`65aadfa`, seule compatible avec la base non migrée) construite en production. Médianes : ouverture 5,8 s → 3,2 s, navigation 3,2 s → 1,8 s ; écrans sous 3 s : 2/24 → 11/24 à l'ouverture, 10/20 → 17/20 en navigation ; aucun débordement horizontal à 360 px.
  - Corrections : compte, entreprise, rôle et permissions relus en une requête SQL au lieu de quatre requêtes successives (`getUserByAuthId`, objet identique vérifié sur les 11 comptes de démo d'`annona-dev`) ; verrou du jour et liste des commandes admin : lectures indépendantes en parallèle ; deux cibles tactiles trop petites (nom du client dans la liste, liens des mentions légales manquantes).
  - Écart expliqué : serveur local à 0,52 s par aller-retour vers la base (quelques ms en production, `cdg1` et `eu-west-3`) ; les écrans encore au-dessus de 3 s (Commandes, Tournées, Tableau de bord, Production, Ma tournée à l'ouverture, Mes commandes) sont ceux qui enchaînent le plus de lectures.
  - 10 novembre 2026, décision d'Orso (« je t'autorise à tout ») : `RoleGuard` affiche la page du portail client et du livreur et lance ses requêtes sans attendre la session du navigateur ; une fois la session connue, un autre rôle ou une session absente redirige comme avant (`roleGuardShowsPage`, `src/components/auth/role-guard.tsx`). Commit `cb442e1`. Vérifications : `tests/lot1-d9-role-guard.test.ts` (2 tests) ; `npm run check` sortie 0, 805/805 ; `next build` sortie 0. Non vérifié : effet mesuré (mesure des écrans à refaire), rechargement réel dans le navigateur (LOT1-RECETTE).
  - Non fait : mesure contre un déploiement Vercel ; vrais iPhone et Android (aucun appareil). Écrans du lot 1 mesurés à la recette du soir.
  - Vérifications : `tests/lot1-d9-auth-query.test.ts` (conversion des colonnes et des dates, une seule requête) ; tests existants adaptés (`account-access`, `auth-role-real-guard`) ; `npm run check` sortie 0, 803/803 ; `next build` sortie 0.

