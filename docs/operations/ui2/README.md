# UI-2 — Recette mobile, clavier et lisibilité

Date de référence : 16 octobre 2026. Utiliser le serveur local sur `http://127.0.0.1:3106` avec la démo TutelLiv. Cette recette ne crée aucune commande : le formulaire est seulement soumis vide afin de vérifier ses erreurs.

## Écrans essentiels sur petit écran

Régler le navigateur sur 390 × 844 px, puis contrôler successivement :

1. Administrateur : `/dashboard`, `/dashboard/orders` et `/dispatch`.
2. Client : `/portal`, `/portal/orders/new` et `/portal/deliveries`.
3. Chauffeur : `/driver` et `/driver/missions`.

Sur chaque écran, vérifier qu'il n'existe aucun défilement horizontal de la page, qu'un titre décrit le contenu et que le premier appui sur Tab révèle « Aller au contenu principal ». Entrée doit alors placer le focus sur le contenu principal. Les tableaux et la barre de navigation client peuvent défiler dans leur propre conteneur sans élargir la page.

## Clavier et états visibles

1. Depuis le tableau de bord administrateur, ouvrir le menu mobile au clavier. Le focus doit rester dans le menu ; Échap doit le fermer et rendre le focus au bouton d'ouverture. La page active doit être annoncée.
2. En persona Client, ouvrir `/portal/orders/new`, parcourir les choix au clavier et soumettre le formulaire vide. Les erreurs doivent apparaître en rouge, être annoncées, être reliées à leur champ et le focus doit atteindre un champ invalide. Chaque champ de texte doit avoir un libellé.
3. Ouvrir le détail d'une commande. La carte « Suivi partagé » doit rester dans la largeur et annoncer son état de chargement. Son historique doit rester lisible sans position GPS disponible.
4. En persona Chauffeur, ouvrir `/driver/missions`. Les actions doivent avoir un nom explicite et une cible d'au moins 24 px. Ouvrir « Suivi de la commande » : la fenêtre doit tenir dans l'écran, se fermer avec Échap et ne pas produire de débordement horizontal.
5. Activer la préférence système de réduction des animations. Les transitions décoratives doivent devenir quasi instantanées.

## Contrôles automatisés

- `node --import tsx --test tests/ui-accessibility.test.ts` contrôle les contrastes AA, la présence du lien d'évitement et l'association des erreurs de formulaire.
- `npm run check` contrôle les types, le lint et toute la suite de tests.
- Les résultats navigateur sont conservés dans `outputs/ui2/browser-audit.json` et `outputs/ui2/browser-interactions.json` ; les quatre captures du même dossier montrent le menu, les erreurs client, le suivi et les missions chauffeur.
