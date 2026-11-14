# Applications mobiles (MOBILE-1, ENF-01)

Décision du 6 novembre 2026 : applications iOS et Android par **Capacitor**, pour les espaces client (`/portal`) et livreur (`/driver`). Le boulanger, l'administrateur et le super-administrateur restent sur le site web (ENF-01).

## Architecture retenue

**Une seule application « Annona »** (`fr.annona.app`), pour les commerçants et les livreurs.

Pourquoi une seule et pas deux (« Annona » et « Annona Livreur ») :

- la connexion envoie déjà chaque compte vers son espace (middleware : commerçant → `/portal`, livreur → `/driver`) ; deux applications ne différeraient que par leur page d'accueil ;
- un seul projet iOS et un seul projet Android à maintenir, une seule fiche par magasin, une seule revue Apple et Google à chaque version, une seule clé APNs et un seul projet Firebase ;
- les autorisations (appareil photo, position) ne sont demandées qu'au moment où elles servent : un commerçant ne les voit jamais.

Revenir à deux applications reste simple : un second `capacitor.config` avec un autre `appId` et `appStartPath: "/login/driver"`.

**Application hébergée.** L'application Next.js a du rendu serveur et des routes API : pas d'export statique. L'application native charge le site Annona (`server.url`) dans sa vue web, à partir de `/login` (`server.appStartPath`). Les mises à jour du site arrivent donc sans nouvelle version des applications ; une nouvelle version n'est nécessaire que pour un changement natif (module Capacitor, autorisation, icône).

- `capacitor.config.ts` : identifiant, nom, adresse du site, page de repli. Les réglages purs sont dans `src/lib/native/app-config.ts` (testés).
- `mobile/www/` : `webDir` minimal, la seule page embarquée : « Pas de connexion / Réessayer » (`server.errorPath`), affichée quand le site ne répond pas. `app-config.js` (adresse à réessayer) y est réécrit à chaque commande `cap` (non versionné).
- `mobile/assets/` : sources des icônes et écrans de lancement (tirées de `public/brand/`), à régénérer avec `npm run mobile:assets`.
- `ios/` (Swift Package Manager, pas de CocoaPods) et `android/` : projets natifs générés par `cap add`, puis modifiés à la main (voir plus bas). Ne pas les régénérer sans reporter ces modifications.

Mise en garde : la documentation Capacitor présente `server.url` comme un réglage de développement. Il fonctionne en production (les modules natifs sont injectés dans la page chargée), mais Apple peut refuser une application qui « n'est qu'un site » (règle 4.2). Les fonctions natives ajoutées (notifications, appareil photo, position, ouverture de Plans et Waze, réseau) sont l'argument à présenter à la revue.

## Ponts natifs (`src/lib/native/`)

Chaque pont détecte l'application (`Capacitor.isNativePlatform()`, `platform.ts`) et garde le comportement web actuel dans un navigateur.

| Besoin | Navigateur (inchangé) | Application native |
|---|---|---|
| Notifications NOT-01 à NOT-03 et nouvelle tournée | cloche du portail, e-mail, push web du livreur | `push.ts` : autorisation, jeton envoyé à `/api/native/push-token`, toucher → page `/portal…` ou `/driver…` |
| Photo d'un problème (LIV-05) | champ fichier `capture` | `camera.ts` : appareil photo du système (image en base64 → `Blob`, puis même file hors réseau) |
| Position pendant la tournée (ENF-04) | `navigator.geolocation` | `geolocation.ts` : module natif, autorisation « pendant l'utilisation » seulement |
| Plans et Waze (LIV-04, critère 7) | lien `target="_blank"` | `navigation.ts` : `AppLauncher.openUrl`, l'application Plans ou Waze s'ouvre |
| Réseau (LIV-06, critère 8) | événements `online` / `offline` | `network.ts` : module `Network` + retour au premier plan (`App`) relancent la file |
| Déconnexion | copie hors réseau effacée | `device-logout.ts` : jeton natif retiré pour ce compte, copie effacée |

Règle ENF-04 : `driverLocationAllowed` (`location-policy.ts`) n'autorise la position que si une tournée est `IN_PROGRESS` (statut confirmé par le serveur) ; le suivi s'arrête dès qu'elle ne l'est plus, aucune autorisation d'arrière-plan n'est déclarée (ni `NSLocationAlways…` sur iOS, ni `ACCESS_BACKGROUND_LOCATION` sur Android). Le serveur refuse aussi toute position hors tournée.

## Notifications natives (serveur)

- Jetons : table existante `driver_push_subscriptions`, **sans migration**. Un jeton y est rangé avec `endpoint = "native:<ios|android>:<jeton>"` et des clés `p256dh`/`auth` à `native`. Même limite de 5 appareils par compte ; un téléphone repris par un autre compte change de propriétaire (clé unique). Le nom de la table date du push web livreur : les commerçants y sont rangés aussi. Un renommage (`device_push_subscriptions`) serait une migration à décider plus tard, pas nécessaire au fonctionnement.
- Route : `POST /api/native/push-token` (commerçant ou livreur, entreprise du compte), `DELETE` (retire le jeton de ce compte).
- Envoi : `src/domains/notification/native-push.service.ts` parle directement à APNs (HTTP/2, jeton ES256) et à FCM v1 (compte de service, jeton RS256). Canal `native_push` enregistré par `registerNotificationChannel` (`native-push-channel.ts`) pour NOT-01 à NOT-03 ; la notification « Nouvelle tournée » du livreur (`deliverDriverMissionPush`) sert aussi les téléphones natifs.
- **Inactif sans clés** : sans `APNS_*` ni `FCM_*`, le canal répond « disabled » sans lire la base (comme l'e-mail sans Resend). Un échec d'envoi natif est journalisé et ne relance pas la tâche (sinon les autres canaux, déjà passés, sonneraient deux fois).
- Côté application, l'enregistrement est coupé tant que `NEXT_PUBLIC_NATIVE_PUSH` ne vaut pas `on` : sans `google-services.json`, l'enregistrement FCM ferait échouer l'application Android.

## Hors réseau

- Navigateur et Android : `public/sw.js` copie, **réseau d'abord**, l'écran `/driver`, la lecture de la tournée (`GET /api/driver/rounds`) et les fichiers `/_next/static`. Sans réseau, un rechargement réaffiche la tournée déjà chargée ; les gestes restent dans la file IndexedDB (LIV-06). Jamais copiés : les envois (POST), le portail, le back-office, une redirection (session expirée). Activé seulement sur le build de production (`DriverOfflineCacheRegistrar`) ; copie effacée à la déconnexion.
- iPhone (application) : la vue web d'iOS n'active les service workers qu'avec les « App-Bound Domains » (`WKAppBoundDomains` + `ios.limitsNavigationsToAppBoundDomains`), à déclarer avec le domaine de production définitif. En attendant, un rechargement sans réseau affiche la page « Pas de connexion » ; l'application reste ouverte sur la tournée tant qu'elle n'est pas rechargée, et la file part au retour du réseau.

## Variables

| Variable | Où | Rôle |
|---|---|---|
| `CAPACITOR_SERVER_URL` | poste qui lance `cap sync` | Origine chargée par l'application. Défaut `http://localhost:3000` (simulateur iOS). Émulateur Android : garder `http://localhost:3000` et lancer `adb reverse tcp:3000 tcp:3000` (avec `http://10.0.2.2:3000`, la connexion est refusée : « Origine de la requête refusée », contrôle SEC-6 de `src/lib/security/origin-check.ts`) ; vrai téléphone : `http://<IP du poste>:3000` avec la même valeur dans `NEXT_PUBLIC_APP_URL`, ou `adb reverse` par câble USB. Production : l'URL HTTPS hébergée dans l'UE. HTTP refusé hors réseau local. |
| `NEXT_PUBLIC_NATIVE_PUSH` | site (build) | `on` pour demander l'autorisation et enregistrer le jeton dans l'application. À activer seulement quand Firebase et APNs sont configurés. |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` | serveur | Clé `.p8` d'Apple (Certificates, Identifiers & Profiles › Keys). `APNS_PRIVATE_KEY` : contenu PEM, `\n` échappés acceptés. |
| `APNS_TOPIC`, `APNS_ENVIRONMENT` | serveur | Défauts : `fr.annona.app`, `production` (TestFlight, App Store) ; `development` pour une application installée depuis Xcode. |
| `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | serveur | Compte de service Firebase (rôle « Firebase Cloud Messaging API Admin »). |

## Commandes

```bash
npm run mobile:sync        # cap sync : copie la page de repli et la configuration dans ios/ et android/
npm run mobile:ios         # cap sync ios + ouvre Xcode
npm run mobile:android     # cap sync android + ouvre Android Studio
npm run mobile:build:ios   # compilation iOS simulateur sans signature (contrôle)
npm run mobile:assets      # régénère icônes et écrans de lancement depuis mobile/assets
CAPACITOR_SERVER_URL=https://app.exemple.eu npm run mobile:sync   # cible de production
```

Essai local : `npm run dev`, puis lancer l'application depuis Xcode ou Android Studio (l'application charge `http://localhost:3000/login`).

Essai Android sans Android Studio (poste Windows de Théo, 14 novembre 2026), JDK 21 dans `JAVA_HOME` :

```bash
npx cap sync android                                   # CAPACITOR_SERVER_URL vide : http://localhost:3000
cd android && ./gradlew assembleDebug                   # android/app/build/outputs/apk/debug/app-debug.apk
sdkmanager "emulator" "system-images;android-36;google_apis;x86_64"
avdmanager create avd -n annona-pixel -k "system-images;android-36;google_apis;x86_64" -d pixel_7
emulator -avd annona-pixel                             # accélération WHPX sous Windows
adb reverse tcp:3000 tcp:3000                          # le localhost du téléphone mène au poste
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

La vue web d'une application de debug se pilote depuis le poste : `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`, puis le protocole Chrome DevTools (Playwright `connectOverCDP` n'est pas pris en charge par la vue web Android).

## Modifications faites à la main dans les projets natifs

- iOS `Info.plist` : langue `fr`, textes d'usage en français (appareil photo, photothèque, position « seulement pendant votre tournée »), `remote-notification`, `NSAllowsLocalNetworking` (essais sur le réseau local), portrait seulement sur téléphone.
- iOS `AppDelegate.swift` : transmission du jeton APNs au module de notifications.
- Android `AndroidManifest.xml` : réseau, position fine et approximative (premier plan), appareil photo (facultatif), `POST_NOTIFICATIONS`. Android n'a pas de texte d'usage déclaratif : l'application explique chaque demande à l'écran.

## État des vérifications (6 novembre 2026)

- `npx cap sync` : réussi (8 modules natifs iOS et Android).
- iOS : **non compilé de bout en bout**. Xcode 26.6 refuse toute destination iOS (« iOS 26.5 is not installed », composant à télécharger dans Xcode › Settings › Components) ; en compilation par cible (`-target App -sdk iphonesimulator` ou `iphoneos`), les dépendances Swift sont résolues et les premiers modules Capacitor compilent, puis le catalogue d'images du module appareil photo échoue (« No available simulator runtimes »). Contrôle partiel : `AppDelegate.swift` et `SceneDelegate.swift` passent `swiftc -typecheck` contre `Capacitor.xcframework` 8.6.0.
- Téléchargement des dépendances Swift : sur ce poste, `xcodebuild` restait bloqué en téléchargeant `Capacitor.xcframework.zip` et `Cordova.xcframework.zip`. Contournement : les télécharger avec `curl` (sommes de contrôle vérifiées, identiques à `Package.swift` de `capacitor-swift-pm`) et les déposer dans `~/Library/Caches/org.swift.swiftpm/artifacts/` sous le nom de l'URL où chaque caractère non alphanumérique devient `_`.
- Android (14 novembre 2026, poste Windows de Théo) : APK de debug compilé (`assembleDebug`, 10,6 Mo), installé sur un émulateur Pixel 7 sous Android 16 ; connexion livreur (`/driver`, profil) et client (`/portal`, « Commander ») réussies dans l'application, 0 erreur JavaScript ; bouton Google masqué comme prévu. Captures `outputs/mobile1-android/`. Non vérifié : vrai téléphone, notifications (Firebase absent), position, appareil photo, hors réseau.

## Reste à faire avant publication (propriétaire, dans l'ordre)

1. **Hébergement UE et URL définitive** du site (ENF-04 : hébergement dans l'Union européenne). Puis `CAPACITOR_SERVER_URL=<URL> npm run mobile:sync`.
2. **Compte Apple Developer** (99 €/an) : équipe de signature dans Xcode (Signing & Capabilities), capacité « Push Notifications », identifiant `fr.annona.app`, clé APNs `.p8` → variables `APNS_*`.
3. **Compte Google Play Console** (25 € une fois) : fiche, signature de l'application.
4. **Firebase** : projet, application Android `fr.annona.app` → `android/app/google-services.json` (non versionné) ; compte de service → variables `FCM_*`. Puis `NEXT_PUBLIC_NATIVE_PUSH=on`.
5. **Postes d'essai** : installer Android Studio (SDK, Java) et un runtime de simulateur iOS (Xcode › Settings › Components), ou brancher un vrai iPhone et un vrai téléphone Android.
6. Essais sur vrais téléphones : critères 1, 7 et 8 du cahier des charges, notifications, photo, position pendant la tournée seulement.
7. iPhone hors réseau : déclarer `WKAppBoundDomains` (domaine de production) et `limitsNavigationsToAppBoundDomains` pour activer la copie hors réseau, puis la vérifier.
8. Fiches des magasins : captures, description, politique de confidentialité (position, photos, notifications), compte de démonstration pour les revues Apple et Google.
