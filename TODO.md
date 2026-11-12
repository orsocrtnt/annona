# TODO Annona — application de commande et livraison B2B (boulangerie)


<!-- TODO_PROGRESS_START -->
## Progression globale

**11 tâches terminées sur 27 — 41 %**

`████████░░░░░░░░░░░░` · 16 tâches restantes

**À faire par Claude**

- RECETTE-V1 — Recette des dix critères (en dernier)

**À faire par Orso**

- COLLAB-1 — Travailler à deux sur le dépôt (Orso et Théo) (inviter Théo dans l'organisation Supabase qui contient `annona-dev`)
- SEP-1 — Séparer complètement Annona de TutelLiv sur GitHub (dire quoi faire des branches `main` et `preproduction` du dépôt annona)
- ACCES-1 — Accès et réponses du propriétaire (réponses du cahier des charges, mentions légales, clé Resend)
- NOTIF-1 — Notifications (clé Resend dans `.env.local` (ACCES-1) ; ensuite Claude fait l'envoi réel)
- MOBILE-1 — Applications iOS et Android (Capacitor) (hébergement UE, comptes Apple et Google, Firebase, Xcode et Android Studio (liste ci-dessous) ; ensuite Claude)
- LOT1-D1 — Tournées avec livraison du matin et du soir (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D8 — Consignes d'accès modifiables par le client (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D7 — Recherche d'article dans la commande récurrente (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D6 — Tableau de bord cliquable (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D3 — Allergènes sur chaque produit (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D2 — Promotions (fins de série et autres) (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D4 — Comptes « mini admin » (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D5 — Onglet de suivi des livreurs (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit)
- LOT1-D9 — Vérification sur téléphone et lenteur (relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et dire si elle suffit ; vrais téléphones si disponibles)
- LOT1-RECETTE — Tests directs dans Chrome de tout le lot 1 (relire le rapport ; pour le passage avec l'extension Claude in Chrome, te connecter toi-même dans l'onglet (le garde-fou refuse que Claude lise les mots de passe de démo) ou dire si Playwright dans Chrome suffit)

**À faire par Théo**

- Rien pour l'instant

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 11 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge). Deux développeurs : Orso (propriétaire) et Théo ; règles du travail à deux dans `AGENTS.md`. Les tâches sont communes : « Qui » dit seulement qui doit agir ensuite._

**1. Orso**
- Relire et fusionner la PR de `theo/todo-nuit` : elle regroupe les PR #2 à #6 de la nuit du 11 novembre (garde-fou de push, tests sous Windows, erreur `getZoom` de la carte, skill de recette, avertissement avant de désactiver une tournée) ; les fusionner une par une marche aussi. Puis lancer une fois `npm run collab:install-hook` (COLLAB-2).
- Envoyer à Théo `outputs/comptes-demo.md` par un canal sûr : il n'a que le compte admin, donc pas de recette connectée client, boulanger ni livreur.
- Inviter Théo dans l'organisation Supabase qui contient `annona-dev` (COLLAB-1).
- Relire la recette du lot 1 (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher LOT1-D1 à D9 et LOT1-RECETTE si elle suffit.
- Répondre aux questions ouvertes du cahier des charges (ACCES-1) : créneaux du premier client, délai du rappel avant 17h, volumes à deux ans, service de cartographie.
- Fournir les mentions légales des factures (SIREN, TVA, forme juridique et capital, RCS, pénalités, escompte) et une clé Resend pour les vrais envois (ACCES-1, NOTIF-1).
- Dire quoi faire des branches `main` et `preproduction` du dépôt annona, qui portent encore TutelLiv (SEP-1).

**2. Théo**
- Conseillé : installer Node 22.18 comme la CI (Node 24.22.1 installé ; les tests passent avec les deux depuis WIN-1).

**3. Claude (en autonomie, dans l'ordre)**
- MOBILE-1, Android sur la machine de Théo : outils installés ; reste `npx cap sync android`, compilation de l'APK de test, essai sur émulateur ou téléphone.
- RECETTE-V1 : réécrire ou supprimer `tests/e2e/v1-roles.spec.ts` (appelle `POST /api/demo/persona`, retirée).
- LOT1-D9 : tableau de bord admin à 3,3 s, seul écran au-dessus de 3 s : mesurer puis réduire.
- Recettes connectées client, boulanger et livreur dès que les comptes de démo sont chez Théo.

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

  **Qui : Orso — inviter Théo dans l'organisation Supabase qui contient `annona-dev`.**

  - Fait : Théo (`theoner13`) collaborateur du dépôt en écriture (10 novembre) ; `base` protégée (PR obligatoire, contrôles « Contrôles sans secrets » et « Migrations sur PostgreSQL neuf », branche à jour, sans force-push) ; règles « Travail à deux » et « Branche et publication » dans `AGENTS.md` et `.cursor/rules/contexte-markdown.mdc`, listes par personne dans `npm run todo:progress`, le tout fusionné avec la PR #1, première PR sous protection, CI verte ; Théo a cloné le dépôt, rempli et vérifié `.env.local` (11 novembre) ; garde-fou de push : COLLAB-2 (archivée).
  - Reste : l'invitation Supabase de Théo, seulement depuis le tableau (Organization › Team › Invite, rôle Developer : ni CLI ni API d'invitation). Vercel sans objet pour l'instant (seule équipe du compte : « TutelLiv », offre Hobby).
  - Note pour Théo : `DIRECT_URL` passe par le pooler, port 5432 (l'adresse directe n'est joignable qu'en IPv6).

- [ ] **SEP-1 — Séparer complètement Annona de TutelLiv sur GitHub.**

  **Qui : Orso — dire quoi faire des branches `main` et `preproduction` du dépôt annona.**

  - Demande du propriétaire (8 novembre 2026) : TutelLiv et Annona sont deux projets distincts, sans lien entre eux.
  - Fait le 8 novembre 2026 : branche par défaut du dépôt GitHub `orsocrtnt/annona` passée de `preproduction` à `base` (`gh api -X PATCH … default_branch=base` → `base`). La page du dépôt affiche désormais le README Annona. La description du dépôt (« Annona — plateforme SaaS de livraison ») ne citait déjà plus TutelLiv.
  - Liens restants constatés (non modifiés) : `main` du dépôt annona est le même commit que `main` de `orsocrtnt/tutelliv` (`af61494`) ; `preproduction` du dépôt annona porte l'ancien produit (README « # Tutelliv », 367 fichiers citant TutelLiv) ; annona.fr est servi par `tutelliv-preproduction` (Supabase). Les tâches planifiées GitHub échouent toutes les 5 min faute de secrets (aucun secret dans le dépôt annona) ; elles tournent maintenant depuis `base`, toujours sans secrets, donc sans effet.
  - Suite : décision du propriétaire sur `main` et `preproduction` (les remplacer par `base` demande un push et peut redéployer annona.fr), puis rattacher annona.fr à un projet Annona propre.

- [ ] **ACCES-1 — Accès et réponses du propriétaire.**

  **Qui : Orso — réponses du cahier des charges, mentions légales, clé Resend.**

  - `.env.local` : fait le 6 novembre 2026 (mot de passe de la base remis à zéro et clé `service_role` collés par le propriétaire avec `remplir-env.sh`, sans passer par l'agent). Vérifié par Claude : client Prisma par le pooler `aws-1-eu-west-3` port 6543 → `select` réussi ; connexion directe (`prisma db execute`) réussie ; API d'administration Supabase avec la clé `service_role` → 200.
  - Questions ouvertes du cahier des charges (section 9) : liste des créneaux du premier client ; délai du rappel avant 17h ; volumes à deux ans ; service de cartographie (les services gratuits OSRM et IGN suffisent pour les essais, pas pour 200 arrêts par jour). En attendant, valeurs par défaut réglables : créneaux 5h-6h, 6h-7h, 7h-8h ; rappel à 15h.

  - Mentions légales des factures (FACT-1), à saisir dans les paramètres de l'entreprise ou à me donner : SIREN, n° de TVA intracommunautaire, forme juridique et capital, immatriculation RCS, taux des pénalités de retard, conditions d'escompte. Sans elles, le PDF ne les porte pas et le Factur-X est refusé.
  - Clé Resend (`RESEND_API_KEY`) pour les vrais envois d'e-mails (factures, notifications) : à coller dans `.env.local` comme les autres valeurs.

  Terminé quand : les quatre réponses, les mentions légales et la clé Resend sont fournies (`.env.local` de base déjà fait).

- [ ] **NOTIF-1 — Notifications.**

  **Qui : Orso — clé Resend dans `.env.local` (ACCES-1) ; ensuite Claude fait l'envoi réel.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  NOT-01 (rappel avant l'heure limite sans commande pour le lendemain, délai paramétrable), NOT-02 (confirmation à chaque commande validée ou modifiée), NOT-03 (« livreur en approche » quand l'arrêt précédent est livré).

  Terminé quand : tests des déclencheurs ; un envoi réel reçu sur une adresse de test.

  7 novembre 2026, code fait (commit `228a85a`, sans push, sans migration). NOT-01 : route `/api/cron/order-reminders` appelée par `cron-lock-orders.yml` toutes les 10 min ; client actif sans commande ni récurrente active ce jour-là, `reminderLeadMinutes` avant l'heure limite, une seule fois par compte, client et date, jamais après l'heure limite ; commande annulée ou brouillon = pas de commande ; délai 0 = rappel désactivé ; le client peut le couper (Paramètres › Alertes). NOT-02 : après chaque commande validée, modifiée ou annulée par le client et après correction admin ; au plus une confirmation toutes les 5 min par commande (la première tout de suite, les suivantes regroupées, état final relu à l'envoi). NOT-03 : au démarrage de la tournée le premier arrêt est prévenu, puis après « Livré » ou un problème le premier arrêt restant ; une seule fois par arrêt, rejeu hors ligne compris. Canaux : cloche du portail et e-mail par la file ; sans clé Resend, tâche e-mail close « ignorée » (`SKIPPED:EMAIL_DISABLED`) ; `registerNotificationChannel` prêt pour les notifications natives (MOBILE-1).
  Vérifications : 12 tests (dont changements d'heure du 25 octobre et du 29 mars, rejeu sans doublon, isolation) ; Playwright `tests/e2e/notif1-recette.spec.ts` cliqué 3/3 (confirmation dans la cloche, rappel par la route cron avec `?now=`, « livreur en approche » après un « Livré ») ; captures `outputs/recette-notif1-adm1/` ; `npm run check` 717/717 puis 731/731 ; `npm run build` vert.
  Reste : envoi réel reçu sur une adresse de test (critère de la tâche) ; confirmation différée et tâches en échec envoyées seulement au passage de `/api/cron/operations` (toutes les 5 min).

- [ ] **MOBILE-1 — Applications iOS et Android (Capacitor).**

  **Qui : Orso — hébergement UE, comptes Apple et Google, Firebase, Xcode et Android Studio (liste ci-dessous) ; ensuite Claude.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  ENF-01 : emballer les espaces commerçant et livreur avec Capacitor ; notifications natives ; ouverture de Plans et Waze. Publication : comptes Apple Developer et Google Play à ouvrir par le propriétaire.

  Terminé quand : les deux applications s'installent sur un vrai téléphone et passent les critères 1, 7 et 8.

  7 novembre 2026, partie sans comptes ni téléphone faite (commit `789de93`, sans push, sans migration). Une seule application « Annona » (`fr.annona.app`) plutôt que deux : la connexion envoie déjà chaque compte dans son espace (client → `/portal`, livreur → `/driver`) ; une fiche par store, une revue, une clé APNs, un projet Firebase ; caméra et position demandées seulement à l'usage (deux applications restent possibles avec une seconde configuration). Mode « site hébergé » : `server.url` = `CAPACITOR_SERVER_URL`, page de repli « Pas de connexion / Réessayer » dans `mobile/www`. Projets `ios/` (Swift Package Manager) et `android/` ; textes d'autorisation en français (position « seulement pendant votre tournée », jamais « toujours »), portrait ; icônes et écrans de lancement générés depuis `public/brand`. Ponts `src/lib/native/` (comportement navigateur inchangé) : notifications natives (jeton vers `/api/native/push-token`, rangé dans `driver_push_subscriptions` avec `endpoint = native:<ios|android>:<jeton>`, canal `native_push` via `registerNotificationChannel` ; envoi APNs et FCM écrit mais inactif sans clés), caméra, position seulement pendant une tournée démarrée, Plans et Waze, réseau et retour au premier plan pour relancer la file hors ligne, nettoyage à la déconnexion. `sw.js` garde une copie de `/driver`, des données de tournée et des fichiers statiques (réseau d'abord, build de production seulement, effacée à la déconnexion). Documentation : `docs/MOBILE.md`.
  Vérifications : `tests/mobile1-native.test.ts` ; `npm run check` relancé par l'orchestrateur : 754/754 ; `npm run build` vert ; `npx cap sync` (8 extensions iOS et Android) ; Playwright `tour1-recette` et `cat1-cmd1-recette` 8/8 (recopie 32,3 s) ; aucun dossier lourd versionné (vérifié). Compilation iOS en échec sur ce Mac : Xcode 26.6 refuse toute destination iOS (« iOS 26.5 is not installed ») et le catalogue d'images de l'extension caméra exige un simulateur ; `AppDelegate.swift` et `SceneDelegate.swift` passent `swiftc -typecheck`. Android non compilé sur ce Mac (ni SDK ni Java). Caches créés hors du dépôt, supprimables : frameworks Capacitor et Cordova téléchargés avec curl depuis leur source officielle (empreintes vérifiées) dans `~/Library/Caches/org.swift.swiftpm/artifacts/`, et `~/Library/Developer/Xcode/DerivedData/App-*`.
  Reste au propriétaire, dans l'ordre : (1) hébergement UE et adresse HTTPS définitive, puis `CAPACITOR_SERVER_URL=<adresse> npm run mobile:sync` ; (2) compte Apple Developer (équipe de signature, capacité « Push Notifications », clé APNs `.p8` dans `APNS_*`) ; (3) compte Google Play Console ; (4) projet Firebase (`android/app/google-services.json` hors git, compte de service dans `FCM_*`, puis `NEXT_PUBLIC_NATIVE_PUSH=on`) ; (5) composant iOS dans Xcode (Réglages › Composants) et Android Studio, ou un vrai iPhone et un vrai Android ; puis Claude relance `npm run mobile:build:ios` et teste les critères 1, 7 et 8 sur téléphone ; (6) `WKAppBoundDomains` avec le domaine de production pour la copie hors réseau dans l'application iPhone.
  Douteux : Apple peut refuser une application qui charge un site (règle 4.2 ; les fonctions natives sont l'argument) ; `getPhoto` déprécié dans l'extension caméra 8 ; sur Android, « Plans » ouvre la carte web d'Apple ; la table `driver_push_subscriptions` porte aussi les jetons des clients ; copie hors réseau non essayée sur un build de production.
  11 novembre 2026, machine Windows de Théo : JDK Temurin 21 et SDK Android en ligne de commande (plateforme 36, build-tools 36, platform-tools) installés dans `%LOCALAPPDATA%` (`AnnonaTools/jdk-21`, `Android/Sdk`), licences du SDK acceptées ; `android/local.properties` pointe sur ce SDK (fichier ignoré par git). Premier `gradlew assembleDebug` en échec attendu : `capacitor-cordova-android-plugins/cordova.variables.gradle` absent, il faut d'abord `npx cap sync android`. Reste (Claude, sur la machine de Théo) : `cap sync`, APK de test, essai sur émulateur ou téléphone ; notifications natives inactives sans Firebase.

- [ ] **RECETTE-V1 — Recette des dix critères.**

  **Qui : Claude — en dernier.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  Rejouer les dix critères de la section 10 du cahier des charges sur `annona-dev`, dans le navigateur, avec un rapport et des captures.

  Terminé quand : les dix critères passent et le rapport est dans `docs/rapports/`.

  - 7 novembre 2026 : les dix critères passent dans le navigateur, sur un build de production local (rapport `docs/rapports/2026-11-07-recette-v1-navigateur.md`, spec `tests/e2e/recette-v1.spec.ts` 12/12). Défauts trouvés et retours du propriétaire des 10 et 11 novembre : corrigés, détail dans `docs/TODO-ARCHIVE.md` (journal du 11 novembre).
  - Reste : critères 1, 7, 8 et notifications natives sur vrais téléphones (après MOBILE-1) ; e-mails réels (clé Resend, NOTIF-1) ; mentions légales des factures (ACCES-1).
  - Défauts encore ouverts : N2 (mineur) retour réseau pris en compte au bout de 15 s après un rechargement hors réseau, à revoir sur téléphone ; N1, non vérifié : arrêt remis en attente par l'admin pendant l'état « sent » (test unitaire seulement).
  - Décision N3 (Théo, 11 novembre 2026) : l'outre-mer n'est pas en V1 ; « Aujourd'hui » reste calculé à l'heure de Paris côté boulanger et admin. À rouvrir si une boulangerie d'outre-mer arrive.
  - À faire : `tests/e2e/v1-roles.spec.ts` appelle encore `POST /api/demo/persona`, retirée : le réécrire sur les comptes du seed ou le supprimer.
  - À refaire à la prochaine recette : admin › tableau de bord, changer de page aussitôt, console sans erreur (correction `getZoom`, prouvée sur banc d'essai mais non reproduite dans l'admin).

### Lot 1 de demandes de modification (Théo Nerisson, 10 novembre 2026)

_D1 à D9 codées, migrées sur `annona-dev`, recettées dans Chrome (Playwright) le 10 novembre au soir et fusionnées dans `base` (PR #1). Reste : la relecture d'Orso de chaque demande. Notes pour la suite : D4 — TutelLiv rangeait les modules du mini admin dans `User.settings.miniAdmin.modules` et filtrait les permissions à la lecture (`filterMiniAdminPermissions`, `git show 0475b8d:src/lib/permissions/mini-admin.ts`) ; la liste des tournées (`GET /api/company/zones`) exige `settings:read`, à ouvrir aussi à `merchants:read` pour un mini admin « comptes » sans « paramètres ». D5 — `DriverLocation` (dernière position, `updatedAt`) et `/api/maps/route` existent déjà ; TutelLiv avait `deliveries-live-map.tsx` (`git show 0475b8d:src/components/maps/deliveries-live-map.tsx`). D9 — mesurer « avant » avant toute correction de lenteur. Appliquer les migrations : passer par le pooler en mode session (port 5432 de `DATABASE_URL`), la connexion directe `db.…supabase.co` est injoignable d'ici._

_Source : `outputs/retouche/Demandes de modification - lot 1.pdf` (9 demandes, ordre imposé : 1, puis 8, 7, 6, 3, puis 2, 4, puis 5, puis 9). Branche `orso/lot1-retouches`, un commit par demande, fusionnée dans `base` (PR #1). Migrations du lot appliquées sur `annona-dev` le 10 novembre ; toute nouvelle migration ou seed s'annonce d'abord dans sa tâche (`AGENTS.md`)._

- [ ] **LOT1-D1 — Tournées avec livraison du matin et du soir.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.** **En cours : Orso.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : tournée créée puis supprimée, Matin et Soir seuls, deux commandes le même jour, groupes « Sud matin » chez le boulanger. Défaut majeur trouvé puis corrigé (commande du soir qui reprenait les articles du matin, `cart-sync.ts`) et client sans tournée rendu inactif. Vérification 4 (16h59/17h00) : tests en mémoire seulement.

  - 10 novembre 2026, code fait (commit `6fb6887` sur `orso/lot1-retouches`, sans push). Modèle `DeliveryZone` (nom, plage du matin, plage du soir) ; chaque tournée porte deux créneaux `Slot` (MORNING, EVENING) tenus à jour par `src/domains/company/delivery-zone.service.ts` ; `Merchant.zoneId`. Paramètres : carte « Tournées » à la place des créneaux horaires (créer, modifier, désactiver ; supprimer seulement si jamais utilisée). Fiche client : choix de la tournée ; liste des clients : colonne « Tournée ». Client : seulement « Matin » et « Soir » de sa tournée (refus 400 sinon, et sans tournée), matin et soir du même jour = deux commandes ; libellés « Matin »/« Soir » aussi dans l'historique et les e-mails. Récurrente : matin, soir ou les deux (deux commandes types). Verrouillage : une commande manuelle du matin ne bloque plus la récurrente du soir ; client passé dans une autre tournée → même moment de la nouvelle tournée ; tournées du jour nommées « Tournée Sud matin ». Boulanger : bons groupés par « Sud matin », « Sud soir ». Export entreprise et inventaire DATA-02 : table `delivery_zones` ajoutée. Seed : tournées Nord et Sud (5h30–11h, 16h–19h), anciens créneaux de démo supprimés après recréation des commandes.
  - Choix : l'heure limite reste celle de l'entreprise (17h la veille) pour le matin comme pour le soir ; la plage du soir doit commencer après celle du matin ; anciens créneaux horaires gardés en base pour l'historique, plus proposés ; consignes d'accès bornées à 500 caractères aussi côté admin (demande 8).
  - Vérifications : `npm run check` sortie 0, 764/764 (tests ajoutés dans `tests/adm1-admin.test.ts`, `tests/cmd1-merchant-orders.test.ts`, `tests/lock1-order-lock.test.ts`, `tests/adm1-criterion10-isolation.test.ts`, couvrant les vérifications 1, 3, 4 et 5 du document en mémoire).

- [ ] **LOT1-D8 — Consignes d'accès modifiables par le client.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : le client enregistre « Code portail 1234, déposer à l'arrière », le livreur le voit sur l'arrêt.

  - 10 novembre 2026, code fait (commit `99ccfa4`). Paramètres du client : carte « Consignes d'accès » (texte libre, 500 caractères au plus, compteur), `PATCH /api/portal/merchant` (`requireMerchantActor`), modification journalisée (entité Merchant, acteur = le client). Le livreur lit les consignes en base à chaque chargement de sa tournée (déjà le cas), l'admin les lit et les modifie dans la fiche client (borne passée de 600 à 500). Choix : la modification est visible tout de suite, même pendant une tournée commencée (au moins aussi tôt que demandé).
  - Vérifications : test `tests/tour1-rounds.test.ts` (vérifications 1 et 2 du document en mémoire, isolation, 500/501 caractères) ; `npm run check` vert.

- [ ] **LOT1-D7 — Recherche d'article dans la commande récurrente.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : « bag », « eclair », effacement, à 1 280 et 390 px.

  - 10 novembre 2026, code fait (commit `0c65ad7`). Fenêtre de la commande récurrente : la liste déroulante « Ajouter un produit » est remplacée par une barre de recherche en haut d'une liste filtrée en direct (nom seulement, sans majuscules ni accents, `src/lib/format/search.ts`) ; vide = tout le catalogue ; produit déjà ajouté marqué « Ajouté ». La recherche du catalogue principal n'a pas changé.
  - Vérifications : `tests/lot1-d7-recurring-search.test.ts` (« bag », « eclair » → « Éclair au chocolat », vide) ; `npm run check` vert.

- [ ] **LOT1-D6 — Tableau de bord cliquable.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : chaque chiffre et la progression d'une tournée ouvrent la bonne liste.

  - 10 novembre 2026, code fait (commit `b1f3614`). Les cinq chiffres ouvrent leur liste, même à zéro : commandes du jour → `/dashboard/orders?date=…&view=active`, tournées → `/dashboard/rounds?date=…`, livrés → `view=delivered`, restants → `view=remaining`, problèmes signalés → `view=incidents`. Dans le tableau des tournées, la progression et le nombre de problèmes ouvrent les commandes de la tournée. Liste des commandes : filtre « Afficher » (mêmes définitions que les chiffres) et badge « Problème signalé ». `StatCard` accepte `href`.
  - Vérifications : `tests/lot1-d6-dashboard-links.test.ts` ; `npm run check` vert.
  - Non vérifié : chaque chiffre comparé un à un à sa liste sur un jour chargé (la recette a vérifié que chaque chiffre ouvre la bonne liste).

- [ ] **LOT1-D3 — Allergènes sur chaque produit.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : gluten + lait visibles chez le client, « Allergènes non renseignés », « Aucun allergène ».

  - 10 novembre 2026, code fait (commit `989fdef`). `Product.allergens` (codes des 14 allergènes, `src/domains/catalog/allergens.ts`) et `Product.allergensDeclared` (faux = « Allergènes non renseignés », vrai et vide = « Aucun allergène ») ; contraintes CHECK (codes connus, rien sans déclaration). Fiche produit admin : 14 cases, bouton « Aucun allergène », lien « Remettre à non renseignés » (tout décocher revient à non renseignés). Client : toucher la photo ou le nom d'un produit ouvre sa fiche avec ses allergènes.
  - Vérifications : `tests/lot1-d3-allergens.test.ts` (vérifications 1, 2, 3 en mémoire, isolation, codes inconnus refusés) ; `npm run check` sortie 0, 772/772.
  - Reste : produits de démo laissés « Allergènes non renseignés » dans le seed.

- [ ] **LOT1-D2 — Promotions (fins de série et autres).**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : −30 % pour 2 clients (absente chez le 3ᵉ), section en tête, ancien prix barré, limite atteinte puis prix normal, état « Épuisée ». Corrigés : libellé du panier pour une promo partielle, bouton « Arrêter » à 390 px, seed qui gardait les promotions. Vérifications 3 et 5 : tests en mémoire seulement.

  - 10 novembre 2026, code fait (commit `cb60190` sur `orso/lot1-retouches`, sans push). Modèles `Promotion` (prix promo OU réduction en % entier, dernier jour inclus, quantité limitée facultative, tous les clients ou `PromotionMerchant`, arrêt = `stoppedAt`, jamais supprimée) ; `OrderLine.promotionId`, `promoQuantity`, `promoUnitPriceCents` : la part promo de chaque ligne est retenue à la validation (`src/domains/catalog/promotion.service.ts`, `allocatePromotions`, verrou consultatif par promotion) et ne change plus ensuite. Calcul unique : `computeTotals` / `lineAmountCents` (`pricing.ts`) comptent la part promo partout (commande client, liste admin, détail admin, e-mail de confirmation, factures avec une ligne « (promo) », relevés, Factur-X). Admin : page « Promotions » (`/dashboard/promotions`, menu), en cours et terminées (terminée, arrêtée, épuisée), création (produit, % ou prix, dernier jour, quantité, clients choisis avec recherche), arrêt en deux clics. Client : section « Promotions » en tête du catalogue, étiquette « Promo », ancien prix barré, nouveau prix ; panier et détail de commande montrent la part promo. Commande récurrente générée à 17h : reçoit la promotion en cours (et la limite). Export entreprise et inventaire DATA-02 : tables `promotions`, `promotion_merchants`.
  - Choix : la date de fin se juge au moment où la commande est validée (fuseau de l'entreprise), pas à la date de livraison ; le pourcentage s'applique au prix de base, puis le client paie le moins cher de son prix normal (négocié ou de base) et du prix promo ; un client dont le prix négocié est plus bas ne voit pas l'étiquette et ne consomme pas d'unités ; une seule promotion en cours par produit (409 sinon) ; une commande annulée rend ses unités ; une commande validée puis modifiée après la fin garde ses unités promo (jamais plus) ; une correction admin ne fait jamais grandir la part promo ; les unités manquantes à la livraison sont d'abord retirées de la part au prix normal (part promo facturée = min(part promo, quantité livrée)). Permission : `promotions:read` / `promotions:manage` depuis la demande 4 (fonctionnalité séparée du catalogue).
  - Vérifications : `tests/lot1-d2-promotions.test.ts` (11 tests : vérifications 1 à 5 du document en mémoire, arrêt, une seule promotion par produit, facture sur deux lignes, récurrente générée avec la limite, isolation entre entreprises) ; `npm run check` sortie 0, 783/783 ; `next build` sortie 0 (lancé sans le garde-fou `ensure-build`, qui voyait le port 3000 pris par le serveur d'un autre projet, Atelia, laissé tel quel).

- [ ] **LOT1-D4 — Comptes « mini admin ».**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK : création, menu limité, adresses interdites renvoyées et API en 403, droits ajoutés ou retirés pris en compte en 25 s sans reconnexion. E-mail d'invitation non envoyé (pas de clé Resend).

  - 10 novembre 2026, code fait (commit `82a13a2` sur `orso/lot1-retouches`, sans push). Un mini admin est un compte administrateur dont les fonctionnalités accordées sont dans `User.settings.miniAdmin.modules` (aucune colonne nouvelle) ; sans cette clé, administrateur complet. Dix fonctionnalités (`src/lib/permissions/mini-admin.ts`) : tableau de bord, commandes, suivi des livreurs, tournées, catalogue et prix, promotions, comptes clients/boulangers/livreurs, paramètres, facturation et paiements, support. Permissions effectives = celles du rôle limitées aux fonctionnalités (`extractPermissionSlugs`), relues en base à chaque requête : API refusées sans reconnexion. Chaque page de l'administrateur porte sa fonctionnalité (`page-access.ts`) : une adresse tapée à la main est renvoyée vers l'accueil du mini admin (sa première fonctionnalité). Menu filtré ; droits relus à chaque changement de page, au retour sur l'onglet et toutes les 30 s pour un mini admin (`use-access-refresh.ts`), une page retirée est quittée. Comptes : choix « Administrateur (accès complet) » ou « Mini admin » avec cases (une par une ou « Tout cocher »), à la création et à la modification ; étiquette « Mini admin » dans la liste ; modifications journalisées.
  - Règles : seul un administrateur complet crée, modifie, désactive ou supprime un compte administrateur ou mini admin et choisit ses fonctionnalités (403 sinon) ; un mini admin « comptes » gère seulement clients, boulangers et livreurs ; on ne change pas ses propres fonctionnalités ; l'entreprise garde toujours un administrateur complet actif.
  - Choix techniques : nouvelles permissions `promotions:read`, `promotions:manage` (les promotions quittent `catalog:*`) et `tracking:read` (pour la demande 5), données au rôle administrateur par la migration de données `20261110130000_module_permissions` et `prisma/reference-data.ts`. Lectures partagées ouvertes à plusieurs permissions (`requireCompanyAdminAny`) : produits (catalogue, correction de commande, promotions), clients à choisir (prix, promotions, comptes), tournées de la fiche client (paramètres ou clients), suivi du jour et photo d'incident (tableau de bord ou tournées). Réglages de la page « Facturation » : `invoices:*` au lieu de `settings:*` (inventaire `docs/operations/admin01/tenant-api-boundaries.md` à jour). Tableau de bord : les liens vers commandes et tournées sont masqués sans ces fonctionnalités ; fiche client : prix spécifiques masqués sans « catalogue et prix ». Une liste de fonctionnalités vide = aucun écran (refus explicite).
  - Vérifications : `tests/lot1-d4-mini-admin.test.ts` (11 tests : vérifications 1 à 5 du document sur les règles de pages et les permissions effectives, règles des comptes en mémoire, réglages illisibles, chaque page rattachée à une fonctionnalité) ; tests existants mis à jour (gardes reconnues, inventaire, dépendances simulées) ; `npm run check` sortie 0, 794/794 ; `next build` sortie 0.

- [ ] **LOT1-D5 — Onglet de suivi des livreurs.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et cocher si elle suffit.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : OK avec un livreur simulé (géolocalisation émulée) : déplacement, trajet vers les 3 prochains arrêts, « Livré » recalcule le trajet, tournée terminée retirée, carte ↔ fiche. Corrigés : « 1 livré », « prévu à » au lieu de « vers ». Itinéraire réel non vu (pas de fournisseur sur `annona-dev`, tracé « approximatif »).

  - 10 novembre 2026, code fait (commit `3478f45` sur `orso/lot1-retouches`, sans push). Onglet « Suivi livreurs » (`/dashboard/tracking`, fonctionnalité « Suivi des livreurs » des mini admins, permission `tracking:read`). Service `src/domains/round/driver-tracking.service.ts` et `GET /api/tracking` : livreurs dont la tournée du jour est démarrée ; position seulement si reçue depuis le démarrage (au-delà de 90 s sans nouvelle position : « Dernière position connue à … ») ; prochains arrêts dans l'ordre, clients restants, livrés avec l'heure, problèmes signalés ; trajet de la position (ou du laboratoire si pas encore de position) jusqu'aux 3 prochains arrêts, itinéraire calculé côté serveur (fournisseur configuré, LEGAL-1) mémorisé 5 min par position arrondie à ~100 m, sinon segments droits en pointillés marqués « approximatif ». Écran : carte et liste reliées (toucher un livreur sur la carte ouvre sa fiche dans la liste ; toucher la fiche le cadre sur la carte), rafraîchi toutes les 15 s. Téléphone du livreur : dernière position renvoyée toutes les 20 s même à l'arrêt (`HEARTBEAT_MS`), toujours seulement pendant une tournée démarrée. Rien de nouveau n'est conservé : la position reste effacée en fin de tournée (déjà le cas, ENF-04).
  - Vérifications : `tests/lot1-d5-tracking.test.ts` (7 tests : vérifications 1 à 4 du document en mémoire, réseau perdu, tournées non démarrées, terminées ou d'une autre entreprise exclues, accès par fonctionnalité) ; `npm run check` sortie 0, 801/801 ; `next build` sortie 0.
  - Non vérifié : vrai déplacement d'un livreur sur téléphone ; itinéraire réel du fournisseur (aucun sur `annona-dev`, tracé « approximatif »).

- [ ] **LOT1-D9 — Vérification sur téléphone et lenteur.**

  **Qui : Orso — relire la recette (`docs/rapports/2026-11-10-lot1-recette.md`) et dire si elle suffit ; vrais téléphones si disponibles.**

  - 10 novembre 2026 (soir), recette navigateur sur `annona-dev` migrée (Playwright dans Chrome, version de production, `docs/rapports/2026-11-10-lot1-recette.md`) : Décision d'Orso appliquée (`cb442e1`). Deuxième mesure avec les écrans du lot 1 : médianes 2,1 s à l'ouverture, 1,0 s en navigation, 25/26 écrans sous 3 s (tableau de bord admin 3,3 s), aucun débordement ; gain propre à la décision non isolé (base plus rapide ce soir-là). Reste : vrais iPhone et Android.

  - 10 novembre 2026 (commit `80133da` sur `orso/lot1-retouches`, sans push). Compte rendu : `docs/rapports/2026-11-10-lot1-d9-telephone-lenteur.md`. Mesure rejouable `tests/e2e/lot1-d9-perf.spec.ts` (téléphone 360 px, 4G simulée, processeur ×4 ; « ouverture » à cache vide et « navigation » dans l'application), avant/après sur la version d'avant le lot (`65aadfa`, seule compatible avec la base non migrée) construite en production. Médianes : ouverture 5,8 s → 3,2 s, navigation 3,2 s → 1,8 s ; écrans sous 3 s : 2/24 → 11/24 à l'ouverture, 10/20 → 17/20 en navigation ; aucun débordement horizontal à 360 px.
  - Corrections : compte, entreprise, rôle et permissions relus en une requête SQL au lieu de quatre requêtes successives (`getUserByAuthId`, objet identique vérifié sur les 11 comptes de démo d'`annona-dev`) ; verrou du jour et liste des commandes admin : lectures indépendantes en parallèle ; deux cibles tactiles trop petites (nom du client dans la liste, liens des mentions légales manquantes).
  - Écart expliqué : serveur local à 0,52 s par aller-retour vers la base (quelques ms en production, `cdg1` et `eu-west-3`) ; les écrans encore au-dessus de 3 s (Commandes, Tournées, Tableau de bord, Production, Ma tournée à l'ouverture, Mes commandes) sont ceux qui enchaînent le plus de lectures.
  - 10 novembre 2026, décision d'Orso (« je t'autorise à tout ») : `RoleGuard` affiche la page du portail client et du livreur et lance ses requêtes sans attendre la session du navigateur ; une fois la session connue, un autre rôle ou une session absente redirige comme avant (`roleGuardShowsPage`, `src/components/auth/role-guard.tsx`). Commit `cb442e1`. Vérifications : `tests/lot1-d9-role-guard.test.ts` (2 tests) ; `npm run check` sortie 0, 805/805 ; `next build` sortie 0. Non vérifié : effet mesuré (mesure des écrans à refaire), rechargement réel dans le navigateur (LOT1-RECETTE).
  - Non fait : mesure contre un déploiement Vercel ; vrais iPhone et Android (aucun appareil). Écrans du lot 1 mesurés à la recette du soir.
  - Vérifications : `tests/lot1-d9-auth-query.test.ts` (conversion des colonnes et des dates, une seule requête) ; tests existants adaptés (`account-access`, `auth-role-real-guard`) ; `npm run check` sortie 0, 803/803 ; `next build` sortie 0.

- [ ] **LOT1-RECETTE — Tests directs dans Chrome de tout le lot 1.**

  **Qui : Orso — relire le rapport ; pour le passage avec l'extension Claude in Chrome, te connecter toi-même dans l'onglet (le garde-fou refuse que Claude lise les mots de passe de démo) ou dire si Playwright dans Chrome suffit.**

  - 10 novembre 2026 (soir) : migrations appliquées et démo rechargée (autorisation d'Orso) ; `env2:verify-dev` corrigé (`2e646fd`) ; recette par un agent sur `cb442e1` (Playwright dans Chrome, spec `tests/e2e/lot1-recette.spec.ts`, mise en place `scripts/e2e/lot1-d5-round-fixture.ts`) : 1 défaut majeur et 6 mineurs ; corrigés (`da2b732` et suivant), rejeu complet : 12 parcours sur 12. Rapport `docs/rapports/2026-11-10-lot1-recette.md`. Vérifications : `tests/lot1-recette-fixes.test.ts` ; `npm run check` sortie 0, 809/809 ; `next build` sortie 0. Nettoyage : 0 compte `e2e-`, démo rechargée (0 promotion), serveur de recette arrêté. Non fait : passage avec l'extension Claude in Chrome (mots de passe de démo inaccessibles à Claude), vrais téléphones.

  - Demande d'Orso (10 novembre 2026) : une fois tout fini, tester chaque demande directement dans Chrome (extension Claude in Chrome, vrais clics, pas seulement Playwright), avec les comptes de démo (`outputs/comptes-demo.md`) : admin, mini admin, boulanger, client, livreur.
  - Parcours à rejouer : les vérifications listées dans le document pour chaque demande (D1 1 à 5, D2 1 à 5, D3 1 à 3, D4 1 à 5, D5 1 à 4, D6 1 à 3, D7 1 à 3, D8 1 et 2, D9 1 à 3), plus les états voisins (client sans tournée, promotion épuisée, mini admin qui tape une adresse interdite), en clair et en sombre, sur ordinateur et en largeur téléphone.
  - Terminé quand : chaque vérification est passée dans Chrome, avec captures et rapport dans `docs/rapports/`, défauts trouvés corrigés et rejoués.
