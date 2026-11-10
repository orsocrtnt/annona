# Recette navigateur du lot 1 (LOT1-RECETTE)

Date : 10 novembre 2026. Branche `orso/lot1-retouches`, sans push. Base `annona-dev` (`fqzlfszgyeyfeshllqtj`).

## Préparation

- Migrations appliquées sur `annona-dev` avec l'autorisation d'Orso : `20261110100000_delivery_zones`, `20261110110000_product_allergens`, `20261110120000_promotions`, `20261110130000_module_permissions`. Démo rechargée (`npm run db:seed`, 12 comptes dont le mini admin).
- `npm run env2:verify-dev` visait encore l'ancien projet (`tutelliv-dev`, défaut N4 de la recette V1) : corrigé (commit `2e646fd`), l'ancien projet passe dans la liste refusée.
- Version de production (`next build` puis `next start`) sur `localhost:3110`, pour que les temps soient réalistes.

## Méthode

Spec rejouable `tests/e2e/lot1-recette.spec.ts` : Playwright dans Chrome (`channel: "chrome"`), vrais clics, comptes de démo lus à l'exécution dans `outputs/comptes-demo.json` (jamais affichés). Chaque écran nouveau est vu en clair et en sombre, à 1 280 et 390 px, avec relevé des erreurs console. Livreur simulé par géolocalisation émulée ; tournée du jour remise à l'état « assignée » par `scripts/e2e/lot1-d5-round-fixture.ts`. Captures et constats : `outputs/recette-agents/lot1/` (non versionné).

Premier passage sur `cb442e1`, corrections, puis rejeu complet sur `da2b732` + retouches (ce rapport) : 12 parcours sur 12 passent.

**Écart avec la demande** : Orso avait demandé un passage avec l'extension Claude in Chrome dans son propre Chrome. Il n'a pas été fait : se connecter demande de lire les mots de passe des comptes de démo, ce que le garde-fou automatique de la session refuse (« matérialisation d'identifiants »). La recette a donc été faite dans Chrome par Playwright, qui lit les comptes sans que l'agent les voie.

## Résultats (après corrections)

| Demande | Vérifications du document | Résultat |
|---|---|---|
| D1 Tournées matin et soir | 1 créer « E2E Est », la retrouver, la supprimer ; colonne « Tournée » et choix dans la fiche client · 2 Matin et Soir seulement · 3 commande du matin et du soir le même jour · 5 groupes « Sud matin » chez le boulanger | OK |
| D1 | 4 verrouillage 16h59 / 17h00 | Tests en mémoire seulement (heure réelle non simulable au navigateur) |
| D1 client sans tournée | Message, aucune commande possible | OK après correction |
| D2 Promotions | 1 −30 % pour 2 clients, absente chez le 3ᵉ · 2 section en tête, étiquette, ancien prix barré · 4 limite atteinte, unité suivante au prix normal ; promotion épuisée | OK |
| D2 | 3 lundi suivant · 5 prix négocié plus bas | Tests en mémoire seulement |
| D3 Allergènes | 1 gluten + lait visibles chez le client · 2 « Allergènes non renseignés » · 3 « Aucun allergène » | OK |
| D4 Mini admin | 1 création · 2 menu Commandes + Suivi livreurs · 3 adresses interdites renvoyées vers Commandes, API en 403 · 4 tout coché, visible en 25 s sans reconnexion · 5 « Commandes » retirée, page quittée en 25 s | OK (e-mail d'invitation non envoyé : pas de clé Resend) |
| D5 Suivi livreurs | 1 déplacement sur la carte · 2 trajet vers les 3 prochains arrêts dans l'ordre · 3 « Livré » → arrêt dans les livrés, trajet recalculé · 4 tournée terminée → plus suivie ; clic carte ↔ fiche | OK (itinéraire « approximatif » en pointillés : pas de fournisseur d'itinéraire configuré sur `annona-dev`) |
| D6 Tableau de bord | 1 commandes du jour · 2 problèmes · 3 chaque chiffre et la progression d'une tournée ouvrent une liste | OK |
| D7 Recherche récurrente | « bag », « eclair », effacement, à 1 280 et 390 px | OK |
| D8 Consignes d'accès | Le client enregistre le texte, le livreur le voit sur l'arrêt | OK |
| D9 Téléphone | 390 px sans débordement ; portail client et appli livreur sans écran blanc ni redirection au chargement | OK ; mesure des temps : `2026-11-10-lot1-d9-telephone-lenteur.md` |

Console : aucune erreur sur les parcours. La seule erreur 409 relevée (création de promotion refusée) était attendue : une promotion du premier passage était redevenue active après le rechargement de la démo (voir correction 7).

## Défauts trouvés et corrigés

1. **Majeur, D1** : la commande du soir reprenait les articles du matin (2 + 3 = 5 Ficelles au lieu de 3). Un panier chargé depuis une commande enregistrée est maintenant vidé quand le nouveau créneau n'a pas de commande, et remplacé quand il en a une (`src/features/ordering/cart-sync.ts`). Rejoué : 3 Ficelles le soir.
2. **Mineur, D1** : client sans tournée, le catalogue, la bannière « commande existante » et la barre du panier restaient actifs. L'ancien créneau mémorisé est oublié, les boutons sont désactivés et la barre est masquée.
3. **Mineur, D2** : le panier affichait « 0,80 € × 4 = 3,60 € » pour une promotion partielle. Il affiche maintenant « 3 × 0,80 € + 1 × 1,20 € = 3,60 € ».
4. **Mineur, D2** : à 390 px, « Arrêter » n'était visible qu'en faisant défiler le tableau. L'état passe sous le nom du produit sur téléphone.
5. **Mineur, D5** : « 1 livrés » devient « 1 livré » ; « vers 05:05 » (heure prévue de la tournée, affichée à 20 h) devient « prévu à 05:05 ».
6. **Mineur** : le sous-titre de Paramètres parlait encore de « créneaux ».
7. **Données de démo** : `npm run db:seed` supprimait les commandes mais gardait les promotions, qui redevenaient « en cours ». Le seed supprime maintenant aussi les promotions de l'entreprise de démo.

Tests ajoutés : `tests/lot1-recette-fixes.test.ts` (règle du panier), `tests/lot1-d9-role-guard.test.ts` (décision D9).

## Non testé

- Vrais iPhone et Android (aucun appareil).
- Passage avec l'extension Claude in Chrome (voir « Écart avec la demande »).
- Envoi réel des e-mails (pas de clé Resend), itinéraire routier réel (pas de fournisseur configuré).

## Nettoyage

Tournée « E2E Est » supprimée ; consignes, allergènes et fonctionnalités du mini admin remis ; compte `e2e-mini-…` supprimé par l'écran Comptes (11 comptes) ; puis `npm run db:seed` : 0 compte `e2e-`, 0 promotion, tournées Nord et Sud. Serveur de recette arrêté (port 3110 libre).
