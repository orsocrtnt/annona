# Rapport MOB-01C — essai GPS sur iPhone, à pied

Date : 29 octobre 2026, de 13 h 35 à 14 h 31, heure de New York (UTC−4). Fixture `mob01c-50cc6eeb` sur la préproduction.

## Résultat

Sur iPhone, l'application web (Safari, ajoutée à l'écran d'accueil) envoie la position **seulement quand l'écran est allumé et l'application au premier plan**. Elle en envoie alors une toutes les 5 s environ, avec une précision de 5 à 34 m. Quand l'écran est verrouillé ou que le livreur passe dans une autre application, iOS suspend l'envoi : aucune position n'arrive. L'envoi reprend en quelques secondes dès le retour dans l'application.

Ce comportement ne contredit pas la promesse retenue (« position datée ») : la dernière position reste horodatée et l'application ne fabrique pas de suivi pendant les trous. En revanche, il exclut un suivi continu avec l'écran verrouillé. Si le produit doit tenir cette promesse, il faudra une application native ; cette décision revient au propriétaire et n'est pas prise ici.

## Conditions

- Un iPhone (captures en 1290 × 2796), Safari, réseau mobile 5G, une seule personne, à pied, en plein Midtown Manhattan. La version d'iOS n'a pas été relevée.
- Parcours : départ sur la 63e rue → Chopt, 60 E 56th St (livraison n° 1) → Apple Fifth Avenue, 767 5th Ave (livraisons n° 2 et 3).
- Le géocodeur IGN ne couvre que la France. Le script de fixture accepte désormais un 4e champ `|lat,lng` qui impose la position (`scripts/mob01c/field-fixture.ts`), relevée dans OpenStreetMap. Les positions enregistrées ont été relues en base avant la marche.
- Le téléphone était en communication pendant la majeure partie de la marche (appel commencé vers 13 h 47, plus de 34 min). L'appel n'a pas empêché l'envoi des positions écran allumé.
- Relevé `npm run mob01c:watch` toutes les 5 s sur le Mac : 611 relevés, journal `outputs/mob01c/journal-2026-10-29T17-35-32-409Z.jsonl` (local, non diffusé).

## Mesures

| Mesure | Valeur |
|---|---|
| Positions reçues | 133, de 13:44:30 à 14:22:26 |
| Intervalle entre deux positions, écran allumé | médiane 5,0 s ; 90 % sous 9,0 s |
| Précision annoncée | 5 à 34 m, médiane 14 m |
| Distance cumulée des positions | environ 1,7 km |

Trous de plus de 30 s, chacun refermé au retour dans l'application (l'heure de fin coïncide avec la « Dernière synchronisation » des captures) :

| Début | Fin | Durée | Cause déclarée par le propriétaire |
|---|---|---|---|
| 13:51:08 | 13:53:43 | 2 min 35 | autre application / écran verrouillé pendant l'appel |
| 13:58:46 | 14:01:37 | 2 min 51 | autre application |
| 14:02:01 | 14:16:19 | 14 min 17 | pause repas, téléphone utilisé dans d'autres applications (Instagram…) |
| 14:16:42 | 14:22:11 | 5 min 29 | autre application |

## Déroulé observé

| Heure | Étape | Observation |
|---|---|---|
| 13:41 | Service démarré | Autorisation de position à activer dans Réglages iOS (« Sites web Safari », position exacte) ; première position à 13:44:30 |
| 13:46–13:47 | Mission 1 : achat puis livraison | Deux transitions distinctes, une capture à 13:45 |
| 13:57:22 | Mission 1 livrée avec photo | Preuve prise à 63 m de l'adresse : dans la zone |
| 14:02:03 | Mission 2 livrée avec photo | Preuve prise à 25 m de l'adresse : dans la zone |
| 14:22:31 | Mission 3 livrée avec photo | Message de distance affiché, puis confirmation forcée ; preuve à 373 m de l'adresse |
| 14:27:34 | Service arrêté | Plus aucune position après l'arrêt |

## Constat à traiter

**Une livraison confirmée hors zone ne laisse aucune trace.** Le blocage à 150 m fonctionne : le message de distance s'affiche. Mais après confirmation forcée, l'historique indique seulement « Statut mis à jour par le chauffeur », comme pour une livraison dans la zone. Le client et l'administrateur ne peuvent pas savoir que la livraison a été validée à 373 m. La position de la preuve est enregistrée, donc la distance pourrait être recalculée et affichée. Décision du propriétaire, le 29 octobre 2026 : signaler la confirmation hors zone et la distance, à l'administrateur et au dispatch seulement, jamais au client. À implémenter.

## Non testé

- Refus de la position dans l'application (étape 2) : l'autorisation était bloquée dans les réglages iOS et a été activée directement.
- Mode avion juste après l'envoi d'une preuve (étape 9), coupure du Service de localisation (étape 10), mode économie d'énergie (étape 12).
- Fermeture complète de Safari depuis le sélecteur d'applications (étape 11) : l'application a seulement été quittée, pas fermée.
- Déclaration d'un échec (étape 14) : la 3e mission a été livrée.
- Double appui sur le bouton de statut (étape 8) : non observable dans le journal.
- Vue administrateur pendant les trous (affichage d'une position ancienne) : non regardée.
- Android : aucun appareil. MOB-01C reste ouverte.

## Nettoyage

`npm run mob01c:cleanup` : `passed: true`, résidu nul (entreprise, utilisateurs, comptes Auth, photos). Les identifiants de `acces.txt` sont supprimés avec la fixture ; seuls le journal et sa synthèse restent dans `outputs/mob01c/`, en local.
