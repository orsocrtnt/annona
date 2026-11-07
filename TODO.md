# TODO Annona — application de commande et livraison B2B (boulangerie)


<!-- TODO_PROGRESS_START -->
## Progression globale

**9 tâches terminées sur 13 — 69 %**

`██████████████░░░░░░` · 4 tâches restantes

**À faire par Claude**

- RECETTE-V1 — Recette des dix critères (en dernier)

**À faire par toi**

- ACCES-1 — Accès et réponses du propriétaire (réponses du cahier des charges, mentions légales, clé Resend)
- NOTIF-1 — Notifications (clé Resend dans `.env.local` (ACCES-1) ; ensuite Claude fait l'envoi réel)
- MOBILE-1 — Applications iOS et Android (Capacitor) (hébergement UE, comptes Apple et Google, Firebase, Xcode et Android Studio (liste ci-dessous) ; ensuite Claude)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 7 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi**
- Répondre aux questions ouvertes du cahier des charges quand tu les as (ACCES-1) : créneaux du premier client, délai du rappel avant 17h, volumes à deux ans, service de cartographie.
- Fournir les mentions légales des factures (SIREN, TVA, forme juridique et capital, RCS, pénalités, escompte) et une clé Resend pour les vrais envois (ACCES-1).
- Mettre à jour le garde-fou `npm run env2:verify-dev`, qui attend encore l'identifiant de `tutelliv-dev` (RECETTE-V1, N4).
- Décider si l'outre-mer est en V1 (fuseau de l'entreprise sur les écrans boulanger et admin, RECETTE-V1, N3).

**2. Claude (en autonomie, dans l'ordre)**
- Faits les 6 et 7 novembre : NET-1 (ancien produit retiré), SCHEMA-1 (nouveau modèle, base de démo), CAT-1 (catalogue et prix), CMD-1 (commande du client, recopie chronométrée à 33 s), LOCK-1 (verrouillage à 17h, récurrentes, tournées brouillon, corrections tracées), BOU-1 (espace boulanger), TOUR-1 (tournées, application livreur, hors réseau) FACT-1 (factures par période, PDF, règlements) et ADM-1 (clients, comptes, paramètres, super-admin, isolation). NOTIF-1 codée, attend la clé Resend pour un envoi réel. MOBILE-1 : partie sans comptes faite, la suite dépend de toi. RECETTE-V1 : les dix critères passent dans le navigateur (7 novembre), trois défauts corrigés (dont l'écran livreur hors réseau). Reste sur téléphones après MOBILE-1.

**3. Attente extérieure**
- Applications mobiles (MOBILE-1) : hébergement UE, comptes Apple Developer et Google Play, Firebase, composant iOS de Xcode ou vrais téléphones (liste ordonnée dans la tâche).

## Cadre

- Référence : `docs/cahier-des-charges/Cahier des charges - version developpeur.pdf` (identifiants CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF, à citer dans le code et les tests) et `docs/cahier-des-charges/TRI-BASE.md` (ce qu'on garde, supprime, modifie et crée).
- Décisions du 6 novembre 2026 : nom **Annona** ; applications mobiles par **Capacitor** ; tickets de support gardés pour les réclamations ; nouveau schéma Prisma propre avec une seule migration initiale ; nouvelle base.
- Branche de travail : `base`. Un commit par lot, **aucun push** sans demande : `preproduction` et annona.fr portent encore l'ancien produit.
- Base de développement : projet Supabase `annona-dev` (`fqzlfszgyeyfeshllqtj`, Paris, créé le 6 novembre 2026). L'ancienne base `tutelliv-dev` a été mise en pause pour libérer la place gratuite (réactivable depuis le tableau Supabase) ; `tutelliv-preproduction` (annona.fr) n'est pas touchée.
- L'ancienne TODO (106 tâches closes, produit coursier) reste dans l'historique git : `git show 0475b8d:TODO.md`.

## Tâches ouvertes

_Tâches closes et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **ACCES-1 — Accès et réponses du propriétaire.**

  **Qui : Toi — réponses du cahier des charges, mentions légales, clé Resend.**

  - `.env.local` : fait le 6 novembre 2026 (mot de passe de la base remis à zéro et clé `service_role` collés par le propriétaire avec `remplir-env.sh`, sans passer par l'agent). Vérifié par Claude : client Prisma par le pooler `aws-1-eu-west-3` port 6543 → `select` réussi ; connexion directe (`prisma db execute`) réussie ; API d'administration Supabase avec la clé `service_role` → 200.
  - Questions ouvertes du cahier des charges (section 9) : liste des créneaux du premier client ; délai du rappel avant 17h ; volumes à deux ans ; service de cartographie (les services gratuits OSRM et IGN suffisent pour les essais, pas pour 200 arrêts par jour). En attendant, valeurs par défaut réglables : créneaux 5h-6h, 6h-7h, 7h-8h ; rappel à 15h.

  - Mentions légales des factures (FACT-1), à saisir dans les paramètres de l'entreprise ou à me donner : SIREN, n° de TVA intracommunautaire, forme juridique et capital, immatriculation RCS, taux des pénalités de retard, conditions d'escompte. Sans elles, le PDF ne les porte pas et le Factur-X est refusé.
  - Clé Resend (`RESEND_API_KEY`) pour les vrais envois d'e-mails (factures, notifications) : à coller dans `.env.local` comme les autres valeurs.

  Terminé quand : les quatre réponses, les mentions légales et la clé Resend sont fournies (`.env.local` de base déjà fait).

- [ ] **NOTIF-1 — Notifications.**

  **Qui : Toi — clé Resend dans `.env.local` (ACCES-1) ; ensuite Claude fait l'envoi réel.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  NOT-01 (rappel avant l'heure limite sans commande pour le lendemain, délai paramétrable), NOT-02 (confirmation à chaque commande validée ou modifiée), NOT-03 (« livreur en approche » quand l'arrêt précédent est livré).

  Terminé quand : tests des déclencheurs ; un envoi réel reçu sur une adresse de test.

  7 novembre 2026, code fait (commit `228a85a`, sans push, sans migration). NOT-01 : route `/api/cron/order-reminders` appelée par `cron-lock-orders.yml` toutes les 10 min ; client actif sans commande ni récurrente active ce jour-là, `reminderLeadMinutes` avant l'heure limite, une seule fois par compte, client et date, jamais après l'heure limite ; commande annulée ou brouillon = pas de commande ; délai 0 = rappel désactivé ; le client peut le couper (Paramètres › Alertes). NOT-02 : après chaque commande validée, modifiée ou annulée par le client et après correction admin ; au plus une confirmation toutes les 5 min par commande (la première tout de suite, les suivantes regroupées, état final relu à l'envoi). NOT-03 : au démarrage de la tournée le premier arrêt est prévenu, puis après « Livré » ou un problème le premier arrêt restant ; une seule fois par arrêt, rejeu hors ligne compris. Canaux : cloche du portail et e-mail par la file ; sans clé Resend, tâche e-mail close « ignorée » (`SKIPPED:EMAIL_DISABLED`) ; `registerNotificationChannel` prêt pour les notifications natives (MOBILE-1).
  Vérifications : 12 tests (dont changements d'heure du 25 octobre et du 29 mars, rejeu sans doublon, isolation) ; Playwright `tests/e2e/notif1-recette.spec.ts` cliqué 3/3 (confirmation dans la cloche, rappel par la route cron avec `?now=`, « livreur en approche » après un « Livré ») ; captures `outputs/recette-notif1-adm1/` ; `npm run check` 717/717 puis 731/731 ; `npm run build` vert.
  Reste : envoi réel reçu sur une adresse de test (critère de la tâche) ; confirmation différée et tâches en échec envoyées seulement au passage de `/api/cron/operations` (toutes les 5 min).

- [ ] **MOBILE-1 — Applications iOS et Android (Capacitor).**

  **Qui : Toi — hébergement UE, comptes Apple et Google, Firebase, Xcode et Android Studio (liste ci-dessous) ; ensuite Claude.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  ENF-01 : emballer les espaces commerçant et livreur avec Capacitor ; notifications natives ; ouverture de Plans et Waze. Publication : comptes Apple Developer et Google Play à ouvrir par le propriétaire.

  Terminé quand : les deux applications s'installent sur un vrai téléphone et passent les critères 1, 7 et 8.

  7 novembre 2026, partie sans comptes ni téléphone faite (commit `789de93`, sans push, sans migration). Une seule application « Annona » (`fr.annona.app`) plutôt que deux : la connexion envoie déjà chaque compte dans son espace (client → `/portal`, livreur → `/driver`) ; une fiche par store, une revue, une clé APNs, un projet Firebase ; caméra et position demandées seulement à l'usage (deux applications restent possibles avec une seconde configuration). Mode « site hébergé » : `server.url` = `CAPACITOR_SERVER_URL`, page de repli « Pas de connexion / Réessayer » dans `mobile/www`. Projets `ios/` (Swift Package Manager) et `android/` ; textes d'autorisation en français (position « seulement pendant votre tournée », jamais « toujours »), portrait ; icônes et écrans de lancement générés depuis `public/brand`. Ponts `src/lib/native/` (comportement navigateur inchangé) : notifications natives (jeton vers `/api/native/push-token`, rangé dans `driver_push_subscriptions` avec `endpoint = native:<ios|android>:<jeton>`, canal `native_push` via `registerNotificationChannel` ; envoi APNs et FCM écrit mais inactif sans clés), caméra, position seulement pendant une tournée démarrée, Plans et Waze, réseau et retour au premier plan pour relancer la file hors ligne, nettoyage à la déconnexion. `sw.js` garde une copie de `/driver`, des données de tournée et des fichiers statiques (réseau d'abord, build de production seulement, effacée à la déconnexion). Documentation : `docs/MOBILE.md`.
  Vérifications : `tests/mobile1-native.test.ts` ; `npm run check` relancé par l'orchestrateur : 754/754 ; `npm run build` vert ; `npx cap sync` (8 extensions iOS et Android) ; Playwright `tour1-recette` et `cat1-cmd1-recette` 8/8 (recopie 32,3 s) ; aucun dossier lourd versionné (vérifié). Compilation iOS en échec sur ce Mac : Xcode 26.6 refuse toute destination iOS (« iOS 26.5 is not installed ») et le catalogue d'images de l'extension caméra exige un simulateur ; `AppDelegate.swift` et `SceneDelegate.swift` passent `swiftc -typecheck`. Android non compilé (ni SDK ni Java). Caches créés hors du dépôt, supprimables : frameworks Capacitor et Cordova téléchargés avec curl depuis leur source officielle (empreintes vérifiées) dans `~/Library/Caches/org.swift.swiftpm/artifacts/`, et `~/Library/Developer/Xcode/DerivedData/App-*`.
  Reste au propriétaire, dans l'ordre : (1) hébergement UE et adresse HTTPS définitive, puis `CAPACITOR_SERVER_URL=<adresse> npm run mobile:sync` ; (2) compte Apple Developer (équipe de signature, capacité « Push Notifications », clé APNs `.p8` dans `APNS_*`) ; (3) compte Google Play Console ; (4) projet Firebase (`android/app/google-services.json` hors git, compte de service dans `FCM_*`, puis `NEXT_PUBLIC_NATIVE_PUSH=on`) ; (5) composant iOS dans Xcode (Réglages › Composants) et Android Studio, ou un vrai iPhone et un vrai Android ; puis Claude relance `npm run mobile:build:ios` et teste les critères 1, 7 et 8 sur téléphone ; (6) `WKAppBoundDomains` avec le domaine de production pour la copie hors réseau dans l'application iPhone.
  Douteux : Apple peut refuser une application qui charge un site (règle 4.2 ; les fonctions natives sont l'argument) ; `getPhoto` déprécié dans l'extension caméra 8 ; sur Android, « Plans » ouvre la carte web d'Apple ; la table `driver_push_subscriptions` porte aussi les jetons des clients ; copie hors réseau non essayée sur un build de production.

- [ ] **RECETTE-V1 — Recette des dix critères.**

  **Qui : Claude — en dernier.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  Rejouer les dix critères de la section 10 du cahier des charges sur `annona-dev`, dans le navigateur, avec un rapport et des captures.

  Terminé quand : les dix critères passent et le rapport est dans `docs/rapports/`.

  7 novembre 2026, passage navigateur fait (commits `b7369b6`, `d6bca8e`, `eb570bf`, sans push ni migration). Une journée de bout en bout sur build de production local, entreprise d'essai « E2E-V1 Boulangerie » créée puis supprimée (démo intacte), heure limite réglée par l'admin dans Paramètres au lieu de `?now=`. Les dix critères passent : recopie 10,9 à 13,6 s (1) ; modification refusée 1,7 s après l'heure limite, 409 aussi par l'API et pour l'annulation (2) ; prix client 1,05 € contre 1,20 € (3) ; récurrentes générées, remplacées par la commande manuelle (4) ; totaux boulanger égaux à la base (5) ; ordre modifié par l'admin vu par le livreur (6) ; Plans en 2 appuis, Waze (7) ; « Livré » hors réseau puis synchro (8) ; facture 36,20 → 32,00 € HT après manquant (9) ; 404 entre entreprises (10). Aussi : NOT-01/02/03 dans la cloche, sombre tablette sans débordement. Rapport : `docs/rapports/2026-11-07-recette-v1-navigateur.md`, spec `tests/e2e/recette-v1.spec.ts` (12/12, 6,7 min), captures `outputs/recette-v1/` (non versionnées).
  Défauts corrigés : Paramètres enregistrables avant chargement, qui écrasaient l'heure limite (`b7369b6`) ; écran livreur blanc après rechargement hors réseau (`d6bca8e`, test dans `tests/mobile1-native.test.ts`).
  Défauts ouverts : N1 corrigé (`c59e56e`) : un « Livré » reçu par le serveur reste affiché (état « sent ») jusqu'à une lecture fraîche, les copies du service worker sont marquées et ne remplacent plus la tournée affichée ; tests ajoutés, `npm run check` relancé par l'orchestrateur 758/758, build vert, e2e `recette-v1` 12/12 (Beta reste livré, 2 / 3, après coupure et rechargement hors réseau) ; non vérifié : arrêt remis en attente par l'admin pendant l'état « sent » (test unitaire seulement), vrai téléphone ; N2 (mineur) retour réseau pris en compte au bout de 15 s après un rechargement hors réseau, à revoir sur téléphone ; N3 (décision) boulanger et admin calculent « Aujourd'hui » à l'heure de Paris, faux pour l'outre-mer ; N4 (outillage) `npm run env2:verify-dev` attend encore l'identifiant `tutelliv-dev` : modification d'un garde-fou, au propriétaire.
  Vérifications de l'orchestrateur : `npm run check` relancé, sortie 0, 755/755 ; rapport et une capture relus.
  Reste : critères 1, 7, 8 et notifications natives sur vrais téléphones (après MOBILE-1) ; e-mails réels (clé Resend) ; mentions légales des factures.
