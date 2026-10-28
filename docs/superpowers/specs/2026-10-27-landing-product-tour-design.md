# Mini-démo produit dans le hero de la landing — design

Date : 27 octobre 2026 · Statut : à relire par le propriétaire

## Objectif

Qu'un visiteur comprenne ce que fait TutelLiv sans quitter la landing, en « jouant » le parcours
complet d'une livraison à travers les trois espaces. La démo remplace la capture du tableau de bord
à droite du titre du hero ; elle ne prend pas tout l'écran.

## Décisions validées (27 octobre 2026)

- **Emplacement** : hero, colonne de droite, à la place de `ProductShot` (`produit-tableau-de-bord.webp`).
  La capture de la section « Suivi en temps réel » reste inchangée.
- **Carte** : plan de ville dessiné en SVG aux couleurs Menthe, sans tuiles réseau.
- **Progression** : le visiteur fait lui-même le geste de chaque scène (le bouton concerné pulse).
- **Scène dispatch** : le geste est « Lancer le dispatcher intelligent », pas une attribution manuelle.
- **Technique** : React + CSS + SVG, aucune nouvelle dépendance.

## Parcours imposé

Indicateur d'étapes en haut du cadre : ① Client · ② Admin · ③ Livreur · ④ Suivi. On peut revenir
sur une étape déjà franchie ; on ne peut pas sauter en avant.

| Scène | Animation automatique | Geste du visiteur | Résultat |
|---|---|---|---|
| ① Espace client | Le formulaire se remplit : retrait, adresse de livraison, créneau | **Commander** | « Commande #1042 envoyée » puis passage à ② |
| ② Admin · dispatch | #1042 arrive dans « Sans livreur » (carte ambre) | **Lancer le dispatcher intelligent** | Les livreurs sont examinés (disponibilité, zone, charge), Karim est retenu avec sa raison (« Zone Paris Est »), la carte passe en bleu « À démarrer », puis passage à ③ |
| ③ App livreur (cadre téléphone) | Notification « Nouvelle mission », puis détail retrait → livraison | **Démarrer la navigation** | Vue GPS sur la carte SVG, trajet surligné, puis passage à ④ |
| ④ Suivi client | Le marqueur avance sur le trajet, l'ETA décroît, la timeline des statuts progresse | — | « Livré ✓ », boutons **Rejouer** et **Voir la démo complète** (`/demonstration`) |

Le passage d'une scène à la suivante se fait automatiquement après le résultat du geste (courte
pause), pour que chaque clic du visiteur fasse avancer l'histoire.

L'animation du dispatcher reflète le comportement réel de `src/domains/delivery/auto-dispatch.service.ts`
(éligibilité, zone puis priorité/charge, raison affichée) sans le présenter comme une IA.

## Contenu et ton

- Données fictives codées en dur (Paris, noms de livreurs, numéro de commande) ; aucun chiffre
  marketing ni logo client (décision DA du 26 octobre).
- DA Menthe (planche E) : couleurs d'urgence des cartes — ambre « sans livreur », bleu « à démarrer »,
  vert « en route ».
- Textes français, courts, fidèles aux libellés du produit.

## Architecture

Dossier `src/features/landing/product-tour/` :

- `tour-machine.ts` — état pur : étape courante, étape maximale atteinte, transitions
  (`advance`, `goTo` limité aux étapes atteintes, `restart`). Sans React, testé unitairement.
- `product-tour.tsx` — composant client : cadre « fenêtre », indicateur d'étapes, zone `aria-live`,
  rendu de la scène courante.
- `scene-client-order.tsx`, `scene-dispatch.tsx`, `scene-driver.tsx`, `scene-tracking.tsx` — une scène
  par fichier ; chacune reçoit un rappel `onDone`.
- `city-map.tsx` — plan SVG partagé par ③ et ④ (rues, trajet, marqueur positionné le long du chemin).
- Styles : classes Tailwind et quelques `@keyframes` préfixées dans `globals.css`, à côté de
  `home-landing-reveal`.

`home-landing.tsx` : seul le `ProductShot` du hero est remplacé par `<ProductTour />`.

## Comportements transverses

- **Mobile** : le cadre passe sous le texte du hero, pleine largeur, même parcours ; hauteur fixe pour
  éviter les sauts de mise en page entre scènes.
- **Accessibilité** : vrais `<button>` accessibles au clavier, focus déplacé sur le geste de la scène
  seulement après une interaction du visiteur (jamais au chargement), étape annoncée via `aria-live`.
- **Mouvement réduit** (`prefers-reduced-motion`) : les états changent sans animation ; le marqueur
  saute aux positions clés.
- **Chargement** : pas d'appel réseau ; le composant ne doit pas dégrader le LCP du hero (rendu
  initial statique de la scène ①).

## Livraison par étapes

Chaque étape : vérification navigateur (clics réels, captures bureau + mobile), `npm run check`,
commit local.

1. Cadre, indicateur, machine d'état et scène ①.
2. Scènes ② et ③.
3. Carte SVG, scène ④, rejouer, finitions (mouvement réduit, mobile).

## Tests

- Unitaires sur `tour-machine.ts` : ordre imposé, retour arrière limité aux étapes atteintes,
  `restart`.
- Test de rendu de la landing existant mis à jour si nécessaire (`tests/growth01-public-journey.test.ts`).
- Parcours réel au clic dans le navigateur, de ① à « Livré ✓ » puis « Rejouer ».

## Hors périmètre

Mode sombre de la démo (Light d'abord), traduction, vraie carte, connexion au back-end, refonte des
autres sections de la landing.

## Version 2 — validée le 27 octobre 2026

Retour du propriétaire après essai : début plus explicite, changements d'espace impossibles à rater,
saisie qui donne l'impression que l'utilisateur écrit, transitions très fluides.

- **Dépendance** : ajout de `motion` (Motion, ex-Framer Motion), chargé uniquement par la démo ; remplace
  la décision « aucune dépendance » de la version 1.
- **Barre d'adresse** : « TutelLiv · Espace client / Espace entreprise / App livreur » (aucun domaine
  inventé) ; l'indicateur d'étapes passe sous la scène.
- **Cartons de transition** à chaque changement d'espace provoqué par un geste (~1,4 s, flou puis fondu) :
  « Pendant ce temps, côté entreprise… La commande arrive au dispatch » ; « Côté livreur… Karim reçoit la
  mission » ; « Retour côté client… Il suit sa livraison en direct ». Pas de carton lors d'une navigation
  par l'indicateur ni pour « Rejouer ».
- **① Espace client** : menu latéral (Accueil, Commandes, Suivi, Factures, Support ; icônes seules en
  mobile), carte de 2 livraisons en cours, liste « Mes livraisons », bouton « Nouvelle commande » en haut
  qui pulse. Au clic, le formulaire glisse en panneau ; saisie lettre par lettre (~45–70 ms, variations),
  curseur clignotant, champ actif surligné, pause entre les champs ; puis « Commander ».
- **② Espace entreprise** : menu latéral (Tableau de bord, Commandes, Dispatch actif, Chauffeurs,
  Facturation) ; la carte #1042 glisse de « Sans livreur » à « À démarrer ».
- **Mouvement réduit** : fondus courts, saisie instantanée, pas de ressorts.
- **Ajustements du 27 octobre (après essai)** : fenêtre agrandie au premier clic sur « Nouvelle commande »
  (et remise à sa taille par « Rejouer ») ; durées allongées (carton 2,8 s, pause après geste 1,3 s,
  trajet 8 s) ; boutons placés comme dans le produit : « Mon espace » + « Nouvelle commande » en haut à
  droite, formulaire terminé par « Annuler » / « Créer la commande » ; « Lancer le dispatcher intelligent »
  dans la barre d'outils du dispatch (à côté de « Carte livraison » / « Carte chauffeurs ») ; côté livreur,
  deux gestes réels dans la carte de mission : « Prendre en charge » puis « Naviguer ».
- **Recette** : chaque étape vérifiée sous Chrome et WebKit (Safari), page rechargée, en mouvement normal
  et réduit.

## Version 3 — validée le 27 octobre 2026

- **Agrandissement** : fenêtre calée sur la zone dessinée par le propriétaire (à 1440 px : x 382 → 1361,
  y 112 → 734, proportions conservées ailleurs) ; le texte du hero glisse à gauche et se resserre ;
  « Annuler », la pastille rouge et « Rejouer » ramènent à l'écran de départ.
- **Parcours en 7 étapes** : ① client commande → ② dispatcher intelligent → ③ livreur prend en charge et
  navigue → ④ client suit en direct → ⑤ livreur : preuve de livraison (photo + nom) → ⑥ client : livré,
  preuve et facture reçue par e-mail → ⑦ entreprise : factures payées / en attente / en retard, « Relancer ».
- **Bulles explicatives** dans la fenêtre, quelques mots chacune, sans texte long.
- **Dispatcher intelligent** : il analyse GPS, disponibilité, charge et trajets, regroupe #1042 avec #1039
  (même secteur) et confie la tournée à Karim. Bulle « Fini le dispatch à la main. » et chrono du temps de
  décision réel dans la démo ; aucun chiffre marketing non mesuré.
- **Décision du propriétaire (27 octobre 2026)** : l'envoi de facture par e-mail, la relance des impayés et le
  dispatcher GPS / trajets optimisés / regroupements sont montrés comme disponibles alors qu'ils ne sont pas
  encore construits (voir la note « Smart Dispatch »). Le risque commercial a été signalé ; le propriétaire
  l'assume. À réaligner si ces fonctions ne sont pas livrées avant la mise en ligne.
