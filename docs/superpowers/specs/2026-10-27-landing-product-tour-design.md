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
