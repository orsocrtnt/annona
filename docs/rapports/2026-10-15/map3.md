# MAP-3 — Carte sobre noir/blanc

## Résultat

La direction visuelle commune des cartes TutelLiv a été ramenée vers un rendu sobre de type Uber : fond cartographique monochrome, surfaces blanches, texte et actions noirs, ombres légères et couleur réservée aux alertes qui doivent réellement attirer l’attention.

La même base est utilisée dans les espaces administrateur, client et livreur. Le thème est centralisé dans `src/lib/maps/map-visual-theme.ts` et la variante `uber` est appliquée par défaut à la carte Leaflet commune.

## Changements vérifiés

- Les tuiles OSM sont affichées en niveaux de gris avec une luminosité et un contraste réduisant la charge visuelle.
- Les trajets utilisent un halo blanc épais sous une ligne noire, afin de rester lisibles sur les rues claires et foncées.
- Les destinations, collectes, étapes et chauffeurs utilisent des marqueurs noir/blanc/gris. La sélection agrandit le point et inverse la surface du libellé en noir.
- Les panneaux de livraisons administrateur et client utilisent des cartes blanches, une bordure discrète et un repère noir pour la sélection.
- Le HUD livreur et la barre de progression emploient une hiérarchie noir/gris sans palette arc-en-ciel.
- Les boutons de zoom, les attributions obligatoires et l’état « fond de carte indisponible » restent visibles et utilisables.
- Le numéro d’une étape atténuée utilise du texte noir sur gris clair afin de conserver son contraste.

## Validation

- `npm run check` : réussi le 16 octobre 2026 ; TypeScript valide, lint sans erreur avec les avertissements historiques, 199/199 tests réussis dont 4 contrats MAP-3.
- `npm run build` : réussi ; build Next.js complet, 96 pages statiques générées.
- `git diff --check` : réussi.
- Recette navigateur locale : affichage 1280 × 720 et 390 × 844, filtre monochrome actif, variante commune `uber` active, commandes accessibles et aucun débordement horizontal mobile.
- Les tests MAP-1/MAP-2 restent au vert pour le cadrage, les destinations absentes, les pannes fournisseur et l’absence de faux trajet.

## Comparaison visuelle

- Avant : [`preuves-map3/avant-desktop.jpg`](preuves-map3/avant-desktop.jpg)
- Après ordinateur : [`preuves-map3/apres-desktop.jpg`](preuves-map3/apres-desktop.jpg)
- Après mobile : [`preuves-map3/apres-mobile.jpg`](preuves-map3/apres-mobile.jpg)

## Limite restante

Le compte de développement disponible pendant la recette ne contenait aucune livraison active ni mission chauffeur. Les trajets, marqueurs sélectionnés/non sélectionnés, panneaux et états dégradés ont donc été validés par les contrats automatisés et les tests fonctionnels MAP-1/MAP-2, tandis que le fond et les cartes ont été vérifiés visuellement dans l’application réelle.

La case MAP-3 reste volontairement ouverte jusqu’à la validation visuelle du propriétaire, explicitement exigée par le critère de fin. Aucun fournisseur, donnée, migration ou service payant n’a été modifié.
