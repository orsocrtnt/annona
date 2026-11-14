# Recette Android : critères 1, 7, 8 et N2 — 14 novembre 2026

RECETTE-V1 et MOBILE-1, sur l'application Android (APK de debug), poste Windows de Théo, nuit du 14 novembre.

- Appareil : émulateur Pixel 7, Android 16 (`system-images;android-36;google_apis;x86_64`). L'application charge `http://localhost:3000` par `adb reverse`.
- Serveur : build de production local (`npm run build`, `next start`), base `annona-dev`.
- Outil : `npm run mobile:recette` (`scripts/mobile/android-recette.mts`). La vue web est pilotée par le protocole Chrome DevTools, car Playwright ne pilote pas la vue web Android. « Hors réseau » signifie mode avion et lien adb vers le poste coupé.
- Données : une entreprise d'essai « E2E-AND Boulangerie » avec 3 clients, la commande de la semaine dernière du client A et une tournée attribuée au livreur pour aujourd'hui. Elle est **supprimée à la fin, même en cas d'échec** (`cleaned: 1` à chaque passe). Rien n'est écrit dans l'entreprise de démo.
- Rapport brut et captures : `outputs/mobile1-android/recette/` (dossier ignoré par git).

## Résultats

| Critère | Résultat |
|---|---|
| 1. Recopier la commande de la semaine dernière en moins d'une minute | **OK** : 8,3 à 10,8 s sur 7 passes, commande validée avec les mêmes quantités (20 + 10). |
| 7. Démarrer, « Livré », arrêt suivant dans Plans en deux appuis | **OK** : 2 appuis. Selon le journal d'Android, l'appareil ouvre `https://maps.apple.com/?daddr=…` dans **Chrome**. |
| 8. « Livré » hors réseau, rechargement hors réseau, visible au retour | **OK** : arrêt `PENDING` hors réseau, « 1 action en attente », écran rechargé hors réseau avec la tournée, synchronisation au retour, tournée terminée (`COMPLETED`). |
| N2. Délai de prise en compte au retour du réseau | **Corrigé, PR #28** : 10 à 15 s avant, **3,1 s** après le retour du réseau sur l'appareil (2 passes). |
| Position du livreur (ENF-04) | **Corrigé, PR #27** : avant, **jamais reçue** par le serveur et 2 erreurs JavaScript (`"Geolocation.then()" is not implemented on android`). Après, reçue **8,9 s** après le démarrage, 0 erreur. |

## Défauts trouvés

1. **Majeur, corrigé (PR #27)** : le suivi de position ne démarrait jamais dans l'application Android. Le suivi livreurs de l'admin et l'alerte « livreur en approche » ne recevaient rien. Le site web n'était pas touché. Cause : un module Capacitor renvoyé par une fonction `async`. Le même défaut, encore latent, a été corrigé pour les notifications natives.
2. **Mineur, corrigé (PR #28)** : N2. Après un rechargement hors réseau, le module natif du réseau, chargé à la demande, ne se chargeait plus, et le retour du réseau n'était vu qu'au passage suivant, toutes les 15 s.
3. **Décision produit, ouvert** : sur Android, « Plans » ouvre la carte web d'Apple dans le navigateur. Google Maps ou Waze conviendraient mieux à un livreur Android. Point à trancher par Orso, déjà noté comme douteux dans MOBILE-1.

## Limites

- Émulateur, et non vrai téléphone. Un vrai Galaxy a été essayé par Théo (Samsung Remote Test Lab) sans relevé détaillé.
- Position simulée (`adb emu geo fix`). Notifications natives non testées, faute de Firebase.
- Les mesures de N2 dépendent du temps de reconnexion de l'émulateur (5 à 6,5 s après la sortie du mode avion).
- Une passe a échoué une fois parce que la connexion de la base au script de recette a été coupée par le serveur Supabase. Le script réessaie désormais ses lectures.
