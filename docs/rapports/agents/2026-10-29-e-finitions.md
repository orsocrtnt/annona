# Lot E — Finitions (UX-NAV-SCROLL, RECETTE-2810)

## Terminé quand
- [x] UX-NAV-SCROLL : `ScrollToTopOnNavigation` (racine) remonte en haut quand le chemin change ; Retour/Avancer, ancres et changements de recherche seule exclus (`src/lib/navigation/scroll-policy.ts`, test unitaire). Conteneur de défilement réel : le document dans les quatre espaces.
- [x] UX-NAV-SCROLL : E2E `tests/e2e/nav-scroll.spec.ts` écrit, non lancé.
- [x] RECETTE-2810 points 2 (partiel), 4, 5, 6, 7, 8, 11 (note), 12, 13 (note), 17
- [x] npm run check vert (1206 tests), pré-vol adverse fait

## Livré
- 4 : l'encart d'échanges/alertes n'est plus monté pour le super-administrateur (`canUseConversations`, rôles partagés avec `conversationAuth`). Aucun droit élargi.
- 5 : `effectiveInvoiceStatus` (calcul à la lecture, même règle que Paiements) utilisé par la liste et la fiche commande : « En retard · N j ».
- 6 : code déjà conforme (`canRemind` reste vrai après une relance non envoyée) ; `demo3-payments.spec.ts` réécrit (attente de la liste, assertion selon l'état final).
- 7 : serveur et interface exigeaient déjà un nom de 2 caractères avec signature ; test ajouté (1 caractère refusé, photo seule : nom facultatif).
- 8 : la bannière de la file n'apparaît plus pendant le premier envoi (`actionNeedsAttention`).
- 12 : `ClientDriverInfo` partagé fiche livraison / fiche commande (prénom + téléphone selon réglage, mêmes données serveur).
- 17 : 18 routes lisaient `request.json()` sans protection ; `.catch(() => null)` puis validation Zod donne 400. Garde-fou `tests/api-json-body-guard.test.ts`. Sans nouvel import : aucune simulation existante cassée.
- 2 : logo mobile de la page de connexion en `priority`.

## Décisions
- Scroll : sur changement de chemin seulement, pas de correctif global. Alternative écartée : `scroll={true}` sur chaque lien.
- 11 : rien à coder (fonction du back-office).
- 13 : cause probable `/favicon.ico`, déjà corrigé ; « à capturer sur le Mac » pour confirmation.

## Non vérifié
- Aucun navigateur : E2E et captures non exécutés ; avertissements LCP non mesurés (seul le logo mobile ciblé) ; erreur 404 console non reconfirmée.

## À lancer sur le Mac
- `npx playwright test tests/e2e/nav-scroll.spec.ts tests/e2e/demo3-payments.spec.ts`
- Écrans à capturer : fiche commande client avec livreur, fiche commande back-office avec facture échue (Light/Dark, 390 et 1 280 px), `/admin` console sans 403.

## Erreurs et leçons
- Pré-vol adverse : spec des paiements instable (attente d'un état final unique, corrigée) ; bannière de file sans écoute du réseau (`useSyncExternalStore`, corrigée). Limite : le portail client affiche encore le statut brut de facture (« En attente » pour une échue), hors périmètre du point 5.
- Leçon : un `.catch(() => null)` évite d'importer un module partagé et de casser les simulations des tests existants.
- Leçon bis : la liste de rôles ne peut pas être importée par conversation-auth (simulations par module) ; miroir vérifié par test.
