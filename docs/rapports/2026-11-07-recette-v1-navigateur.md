# Recette V1 dans le navigateur — les dix critères en une journée (7 novembre 2026)

Première recette des dix critères de la section 10 du cahier des charges, avant les vrais téléphones. Les critères ne sont pas testés un par un : ils s'enchaînent comme une journée, du commerçant jusqu'à la facture.

## Comment

- Code testé : branche `base`, commit `e624d4f` plus les deux correctifs de ce rapport : `b7369b6` et `d6bca8e` (voir « Défauts trouvés »). Build de production local : `npm run build`, puis `next start` sur le port 3270, avec `DATABASE_CONNECTION_LIMIT=5`. Ce build donne des temps réalistes et active le service worker du livreur. Serveur arrêté à la fin.
- Base de données : `annona-dev` (`fqzlfszgyeyfeshllqtj`), via `.env.local`. Aucune migration, aucun push.
- Spec rejouable : `tests/e2e/recette-v1.spec.ts`, 12 étapes en série. La dernière exécution, sur le code final, passe les 12 en 6,7 min. Commande :
  `E2E_BASE_URL=http://localhost:3270 E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/recette-v1.spec.ts`
- Données de test : une entreprise d'essai `E2E-V1 Boulangerie`, créée au début de la recette et supprimée à la fin. Elle contient :
  - trois produits et deux créneaux ;
  - quatre clients : Alpha, Beta, Gamma et Delta ;
  - six comptes : admin, boulanger, livreur, et trois clients, comptes Supabase compris ;
  - une commande livrée la semaine dernière (pour Alpha) ;
  - trois commandes récurrentes.

  L'entreprise de démo joue l'entreprise B du critère 10 : la recette n'y écrit rien. La fin de la spec le vérifie (`leftovers`, tous les compteurs à 0, et `demoWrites: 0`).
- Preuves locales, non versionnées, relues : `outputs/recette-v1/` (captures `v1-*.png`, `rapport.json`, `run*.log`).

### Simuler l'heure sur un build de production (critère 2 et « la nuit »)

Sur un build de production, les paramètres `?now=` et `?date=` des crons sont refusés. La recette n'en utilise donc aucun : tout tourne à l'heure réelle, sur le vrai code. Deux réglages de l'entreprise d'essai remplacent l'heure simulée :

1. **Heure limite.** L'admin règle l'heure limite dans **Paramètres** (clic réel) sur la minute qui suit (au moins 75 s plus tard). Ensuite :
   - le client modifie sa commande juste avant (l'équivalent de 16h59) : réponse 200 ;
   - il rouvre le panier avant l'heure limite et clique « Enregistrer » juste après (17h00) : le serveur répond 409 `DEADLINE_PASSED` ;
   - la même écriture refaite directement par l'API, sans l'interface, est aussi refusée (409), de même que l'annulation (409) ;
   - la quantité en base reste celle acceptée.

   Le cas exact 16:59:59 / 17:00:00 est déjà couvert par des tests unitaires : `tests/cmd1-merchant-orders.test.ts` (« 16:59 modifiable, 17:00:00 verrouillée ») et `tests/lock1-order-lock.test.ts`.
2. **« La nuit passe ».** La spec choisit à l'exécution deux fuseaux, en commençant par ceux que l'application propose :
   - un fuseau « veille », où la livraison D tombe demain : le client y commande ;
   - un fuseau « jour », où D tombe aujourd'hui : la tournée y est livrée, car le démarrage n'est permis que le jour même.

   La spec bascule le fuseau de l'entreprise d'essai entre les deux phases. Ce 7 novembre : Tahiti, puis Paris, avec D = samedi 7 novembre. Aucune donnée n'est décalée. Il existe toujours un couple valable : en dernier recours, les fuseaux `Etc/GMT+12` et `Etc/GMT-14`, réglés directement en base.

Le verrouillage de D n'est pas déclenché par le cron (sans `?date`, il aurait aussi verrouillé des dates échues de la démo). Il se fait quand le boulanger ouvre l'écran de production (`ensureDateLocked`), comme prévu quand le cron est en retard. Le cron de verrouillage lui-même est couvert par `lock1-bou1-recette`.

## Les dix critères

| # | Critère | Résultat | Preuve (spec, `rapport.json`, captures) | Mesures |
|---|---|---|---|---|
| 1 | Recopier la commande de la semaine dernière en moins d'une minute | **OK** | Alpha, connecté, à 390 px : « Recommander », puis la commande du 31 octobre, la date, et « Valider ». La commande est « Validée » avec les quantités et le prix spécifique. Toujours là après rechargement. `v1-02`, `v1-03` | **10,9 à 13,6 s** sur 8 exécutions (dernière : 10,9 s), contre 32 s en build de développement (CMD-1) |
| 2 | Modifiable à 16h59, plus à 17h00 | **OK** | Heure limite réglée par l'admin (`v1-07`). Modification acceptée (200) 89 à 105 s avant l'heure limite. Enregistrement refusé 1,7 à 1,9 s après : 409 `DEADLINE_PASSED`, message « L'heure limite est passée… » (`v1-09`). Écriture directe par l'API : 409. Annulation : 409. Base inchangée (24 baguettes) | Refus constaté à +1,7 s |
| 3 | Prix spécifique d'un côté, prix de base de l'autre | **OK** | Alpha voit 1,05 € avec « Votre prix », Beta voit 1,20 € sans (`v1-05-*`) | — |
| 4 | Récurrente générée sans commande, remplacée par une commande manuelle | **OK** | À l'heure limite : Beta et Delta ont chacun une commande `RECURRING` verrouillée. Alpha n'a que sa commande manuelle : sa récurrente (pain de campagne) n'est pas générée. Gamma : commande annulée seulement. Tous les prix sont figés | — |
| 5 | Totaux du boulanger égaux à la somme des commandes | **OK** | Totaux affichés : baguette 69, croissant 18, pain 4. Ils sont égaux à la somme, calculée en base, des commandes non annulées du jour (`v1-10`) | — |
| 6 | Tournées générées, l'admin déplace un arrêt, le livreur voit le nouvel ordre | **OK** | Une tournée « Tournée 7h – 8h » est générée à l'heure limite (brouillon, 3 arrêts). L'admin attribue le livreur et valide (`v1-13`). Le livreur voit d'abord Delta, Beta, Alpha (`v1-14`). L'admin clique « Descendre Delta » ; après rechargement, le livreur voit Beta, Delta, Alpha, l'ordre enregistré en base (`v1-15`) | — |
| 7 | Après « Livré », Plans ou Waze en deux appuis | **OK** | « Livré » chez Beta. Appui 1 : « Y aller » ; appui 2 : « Ouvrir dans Plans », qui ouvre `maps.apple.com/?daddr=48.860100,2.350200&dirflg=d`. Le lien Waze est présent (`v1-16`, `v1-17`) | 2 appuis |
| 8 | « Livré » hors réseau visible chez l'admin au retour | **OK** (après correctif) | Delta est marqué « Livré » sans réseau : « 1 action en attente », toujours `PENDING` en base. **Rechargement de la page sans réseau** : l'écran revient avec l'action en attente (`v1-19`, `v1-20`) ; il revenait vide avant le correctif D2. L'admin voit « 1 / 3 livrés ». Au retour du réseau : `DELIVERED` en base, puis « 2 / 3 livrés » chez l'admin (`v1-21`) | Synchronisation : 3,3 s sans rechargement, 15 s après un rechargement hors réseau |
| 9 | Un manquant du boulanger réduit la facture | **OK** | Le boulanger signale 20 baguettes livrées sur 24 (`v1-11`). La facture du jour d'Alpha est générée par l'admin : 32,00 € HT, contre 36,20 € commandés. L'écart, 4,20 €, vaut exactement 4 × 1,05 €. TTC 33,76 € (`v1-23`). Alpha voit la facture dans son portail (`v1-24`) | — |
| 10 | Un utilisateur de A ne voit rien de B | **OK** | Depuis A, sur la démo : admin → fiche client 404, liste sans « (démo) », 3 produits seulement ; client → commande 404 ; boulanger et livreur → aucune donnée de la démo. Depuis la démo, sur A : admin → fiche client 404, facture 404, liste sans `E2E-V1` ; client → commande 404, facture 404 (`v1-25`, `v1-26`) | — |

### États voisins et notifications

- **Reprises après rechargement :** commande recopiée, annulation, production, et écran du livreur hors réseau. Le boulanger qui recharge retrouve « préparée » décochée.
- **Annulation avant 17h :** Gamma commande, puis annule. Statut « Annulée », toujours vrai après rechargement (`v1-06`).
- **Commande verrouillée ouverte par le client :** statut « Préparée », plus de « Modifier » ni d'« Annuler » (`v1-12`).
- **« Préparée » :** cochée, décochée (retour arrière vérifié après rechargement), puis recochée. `preparedAt` est renseigné en base.
- **NOT-02 :** « Commande validée » apparaît dans la cloche d'Alpha (`v1-04`).
- **NOT-01 :** le cron des rappels tourne à l'heure réelle, dans la fenêtre « heure limite − 120 min ». Seule Gamma, qui a annulé, reçoit « Pensez à commander pour demain » (une tâche, `v1-09b`). Beta et Delta, couverts par une récurrente, n'en reçoivent pas.
- **NOT-03 :**
  - au démarrage, Beta (premier arrêt) est prévenue : tâche traitée en 5,1 à 5,6 s, « Livreur en approche » dans sa cloche (`v1-18`) ;
  - après le « Livré » de Delta rejoué au retour du réseau, Alpha est prévenue à son tour (`v1-20b`).
- **Mode sombre et tablette** (1024 × 768, tactile) : portail, livreur, boulanger et back-office sont bien en sombre (fond `rgb(20, 23, 22)`), sans débordement horizontal. Captures relues : `v1-sombre-*-tablette`. Sur téléphone, portail et livreur restent clairs même si le système est sombre, conformément à la décision du propriétaire du 30 octobre.
- **Console :** pas d'erreur JavaScript. On ne relève que les 409 attendus (refus du critère 2) et les `ERR_INTERNET_DISCONNECTED` de la phase hors réseau.

## Défauts trouvés

### Corrigés (petits et sûrs)

| # | Gravité | Défaut | Correctif |
|---|---|---|---|
| D1 (`b7369b6`) | Majeur | **Les paramètres « Commandes » pouvaient être enregistrés avant leur chargement.** Les champs affichent d'abord des valeurs par défaut (17:00, Europe/Paris, 120 min). Un « Enregistrer » trop rapide écrasait l'heure limite, **le fuseau** et le délai du rappel de l'entreprise. Vu à la première exécution : le fuseau d'essai est repassé à Paris sans rien dire, et une commande s'est retrouvée « verrouillée » d'un coup. | `src/features/settings/company-settings-card.tsx` : les trois boutons « Enregistrer » restent désactivés et l'envoi est ignoré tant que les paramètres ne sont pas chargés. Vérifié dans le navigateur par la spec (critère 2). |
| D2 (`d6bca8e`) | Majeur | **L'écran du livreur rechargé sans réseau restait blanc** (build de production). La copie de `/driver` et de la tournée était bien servie, mais `/api/auth/session` échouait. Le garde de rôle renvoyait alors vers `/login/driver`, qui n'a pas de copie : page blanche. Le critère 8 tenait sans rechargement, pas avec. | `public/sw.js` : la session est copiée, réseau d'abord, **seulement si c'est celle d'un livreur**. Toute autre réponse (déconnecté, autre rôle) efface la copie. La copie est effacée à la déconnexion, comme le reste du cache. `driverOfflineUrls` ajoute la session. Tests : `tests/mobile1-native.test.ts`. Recette : rechargement hors réseau OK (`v1-20`). |

### Non corrigés

| # | Gravité | Défaut | Détail et correctif proposé |
|---|---|---|---|
| N1 (corrigé, `c59e56e`) | Majeur | **Après un « Livré » envoyé, l'écran du livreur pouvait revenir en arrière si le réseau tombait juste après.** Reproduit par la spec : « Livré » chez Beta en ligne (serveur `DELIVERED`), coupure, puis Beta de nouveau « en cours » et « 1 / 3 livrés ». | Cause vérifiée (passage instrumenté) : `use-driver-action-queue.ts` effaçait l'action dès la réponse du serveur. Aucune relecture de la tournée n'avait abouti avant la coupure (aucun `GET /api/driver/rounds` entre l'envoi et la coupure), et la copie du service worker datait d'avant l'envoi. Au geste suivant, la liste de la file était relue sans l'action : plus rien n'indiquait la livraison.<br><br>Correctif (`c59e56e`) : l'action reçue passe à l'état « sent » dans IndexedDB (photo retirée) et reste appliquée à l'écran, sans badge « en attente », jusqu'à une lecture fraîche de la tournée commencée après l'envoi (`settleSentDriverActions`). `public/sw.js` signale ses copies (`x-annona-offline-copy`) : une copie ne retire jamais un geste et ne remplace pas une tournée déjà affichée. La file n'attend plus la relecture. Tests : `tests/driver-offline-actions.test.ts`, `tests/tour1-rounds.test.ts`, `tests/mobile1-native.test.ts`. Recette : la spec vérifie Beta toujours livré et « 2 / 3 livrés » après la coupure et après le rechargement hors réseau (12 tests sur 12). |
| N2 | Mineur | Après un rechargement hors réseau, le retour du réseau n'est pris en compte qu'au tour suivant de la minuterie (15 s, contre 3 s sans rechargement). | L'événement `online` ne semble pas relancer la file après ce rechargement. À revérifier sur un vrai téléphone (événements réseau natifs) avant de corriger. |
| N3 | Mineur | Écrans du boulanger et de l'admin : « Aujourd'hui / Demain » et l'heure de verrouillage sont calculés **à l'heure de Paris**, pas dans le fuseau de l'entreprise. Le portail, lui, utilise le bon fuseau. | `deadlineLabel(...)` est appelé sans fuseau (défaut `Europe/Paris`, `src/lib/format/delivery-date.ts:20`), et `DeliveryDayPicker` utilise le jour civil de Paris. Sans effet pour une boulangerie en métropole. Faux pour une entreprise des Antilles, de La Réunion ou du Pacifique, alors que ces fuseaux sont proposés dans Paramètres. Décision produit : l'outre-mer est-il en V1 ? Si oui, passer le fuseau de l'entreprise à ces composants. |
| N4 | Mineur (outillage) | `npm run env2:verify-dev` échoue sur la bonne base. Il attend encore l'identifiant de l'ancien projet `tutelliv-dev` (`mhzdmoytxmzudhkivixh`), alors que `annona-dev` est `fqzlfszgyeyfeshllqtj` (`TODO.md`). Le garde-fou bloque donc toute recette qui le respecte à la lettre. | Mettre à jour `DEV_SUPABASE_REF` dans `scripts/env2/verify-dev-env.ts`, ajouter l'ancien identifiant aux projets refusés, et mettre à jour `docs/operations/env2/README.md`. **Non modifié** : la modification d'un garde-fou de sécurité a été refusée par la règle d'autorisation de l'agent ; elle revient au propriétaire. La recette s'est faite sur `annona-dev` (identifiant vérifié contre `TODO.md`, absent de la liste des projets interdits). |

Constat sans défaut : la cloche du portail lue pendant le chargement de la page paraît vide un instant. La spec attend donc la fin du chargement avant de l'ouvrir.

## Vérifications finales

Serveur arrêté (port 3270 libre). `npm run check` : sortie 0, 755 tests sur 755. `npm run build` : sortie 0.

## Ce qui reste à rejouer sur de vrais téléphones

- **Critère 1** dans l'application native (iPhone et Android) : recopie chronométrée au doigt, sur réseau mobile.
- **Critère 7** dans l'application : ouverture réelle d'Apple Plans et de Waze installés. Rappel MOBILE-1 : sur Android, « Plans » ouvre la carte web d'Apple.
- **Critère 8** dans l'application : mode avion pendant une tournée, puis tuer et rouvrir l'application. Sur iPhone, la copie hors réseau dépend de `WKAppBoundDomains` avec le domaine de production. Vérifier N1 et N2 sur le terrain.
- **Notifications natives** (APNs et FCM) : NOT-03 au démarrage et après chaque « Livré » ; notification au livreur quand une tournée est validée.
- **Thème** : le téléphone reste clair (décision du 30 octobre) ; à confirmer sur l'appareil.

## Ce qui dépend du propriétaire

- **Clé Resend** dans `.env.local` (ACCES-1) : aujourd'hui, les e-mails NOT-01, NOT-02, NOT-03 et l'envoi de facture sont tracés « ignorés », avec une notification dans l'application seulement.
- **Mentions légales des factures** (SIREN, TVA, forme et capital, RCS, pénalités, escompte) : la facture affiche « Mentions légales à compléter » (`v1-23`), et Factur-X reste refusé tant qu'elles manquent.
- **Hébergement UE et adresse HTTPS définitive**, puis comptes Apple, Google et Firebase (MOBILE-1), pour les essais sur téléphone ci-dessus.
- **Garde-fou `env2:verify-dev`** (N4) à mettre à jour.
- **Décision produit** sur l'outre-mer (N3).
