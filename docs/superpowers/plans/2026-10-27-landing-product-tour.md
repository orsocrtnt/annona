# Mini-démo produit du hero — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer la capture du hero par une démo semi-interactive en 4 scènes (client → dispatch → livreur → suivi) que le visiteur fait avancer par ses gestes.

**Architecture :** une machine d'état pure (`tour-machine.ts`) pilote un composant client `ProductTour` qui rend une scène par fichier ; une géométrie pure (`city-route.ts`) place le marqueur sur un plan SVG partagé. Animations en CSS, aucune dépendance ajoutée.

**Tech Stack :** Next.js 15 (App Router), React, Tailwind 4, tests `node:test` + `tsx`.

**Spec :** `docs/superpowers/specs/2026-10-27-landing-product-tour-design.md`

## Global Constraints

- Aucune nouvelle dépendance npm ; aucun appel réseau depuis la démo.
- Textes en français ; données fictives codées en dur ; aucun chiffre marketing ni logo client.
- DA Menthe : ambre « Sans livreur », bleu « À démarrer », vert « En route » ; bouton principal vert `#00d46a`, texte encre `#0E1310`.
- Libellés de gestes exacts : « Commander », « Lancer le dispatcher intelligent », « Démarrer la navigation », « Rejouer », « Voir la démo complète » (`/demonstration`).
- Le dispatcher n'est jamais présenté comme une IA ; raison affichée : « Zone « Paris Est » ».
- Seul le `ProductShot` du hero change ; `/landing/produit-carte.webp` reste dans la section suivi.
- `prefers-reduced-motion` : états sans animation.
- Commit local à chaque tâche, jamais de push.

## Review Focus

1. Double clic rapide sur un geste → la démo n'avance que d'une étape (`advanceTour` ignore un `from` qui n'est plus l'étape courante) — testé en tâche 1.
2. Retour sur une étape déjà vue via l'indicateur → la scène se rejoue, `reached` est conservé, impossible de cliquer une étape future — testé en tâche 1.
3. Changement d'étape pendant une animation → aucun minuteur orphelin ne déclenche `onDone` d'une scène démontée (`useTimeline` nettoie ses minuteurs) — vérifié au navigateur en tâche 2.
4. Chargement de la page → le focus n'est jamais volé ; il ne se déplace qu'après une interaction du visiteur — vérifié au navigateur en tâche 2.
5. Largeur 360 px et passage entre scènes → hauteur du cadre fixe, aucun débordement horizontal — captures mobile en tâches 2, 4 et 5.

---

### Task 1 : machine d'état et données fictives

**Files :**
- Create : `src/features/landing/product-tour/tour-machine.ts`
- Create : `src/features/landing/product-tour/tour-data.ts`
- Test : `tests/landing-product-tour.test.ts`

**Interfaces :**
- Produces :
  - `type TourStep = "order" | "dispatch" | "driver" | "tracking"`
  - `const TOUR_STEPS: readonly TourStep[]` (cet ordre) et `const TOUR_STEP_LABELS: Record<TourStep, string>` = Client, Admin, Livreur, Suivi
  - `type TourState = { current: number; reached: number }`
  - `initialTourState(): TourState` → `{ current: 0, reached: 0 }`
  - `advanceTour(state: TourState, from: TourStep): TourState` — no-op si `from` n'est pas l'étape courante ou si c'est la dernière ; sinon `current+1`, `reached = max(reached, current+1)`
  - `goToStep(state: TourState, step: TourStep): TourState` — no-op si l'index dépasse `reached`
  - `restartTour(): TourState` → état initial
  - `tour-data.ts` : `TOUR_ORDER` (`{ number: "#1042", pickup: "Entrepôt Ivry-sur-Seine", dropoff: "18 rue de la Roquette, Paris 11e", slot: "14 h – 16 h", client: "Atelier Verde" }`), `TOUR_DRIVERS` (Karim — disponible, zone Paris Est → retenu ; Sofia — en tournée, charge 4/4 → écartée ; Lucas — zone Paris Ouest → écarté ; chacun avec `name`, `status`, `verdict: "chosen" | "rejected"`, `reason`), `TOUR_DISPATCH_REASON = "Zone « Paris Est »"`

- [ ] **Step 1 : écrire les tests qui échouent** dans `tests/landing-product-tour.test.ts` (style `node:test` + `assert/strict` comme `tests/growth01-public-journey.test.ts`) :
  - `advanceTour(initialTourState(), "order")` → `{ current: 1, reached: 1 }`
  - double geste : `advanceTour(advanceTour(s0, "order"), "order")` → toujours `{ current: 1, reached: 1 }`
  - dernière étape : depuis `current: 3`, `advanceTour(s, "tracking")` → inchangé
  - retour arrière : depuis `{ current: 2, reached: 2 }`, `goToStep(s, "order")` → `{ current: 0, reached: 2 }` ; puis `goToStep(…, "driver")` → `{ current: 2, reached: 2 }`
  - saut en avant refusé : `goToStep(initialTourState(), "dispatch")` → inchangé
  - rejouer depuis un geste passé : `{ current: 0, reached: 2 }` puis `advanceTour(…, "order")` → `{ current: 1, reached: 2 }`
  - `restartTour()` → `{ current: 0, reached: 0 }`
  - `TOUR_DRIVERS` contient exactement un `verdict: "chosen"`, nommé Karim
- [ ] **Step 2 :** `node --import tsx --test tests/landing-product-tour.test.ts` → FAIL (module introuvable)
- [ ] **Step 3 :** implémenter `tour-machine.ts` et `tour-data.ts` selon les interfaces (fonctions pures, pas de React)
- [ ] **Step 4 :** relancer la commande → PASS
- [ ] **Step 5 :** commit `feat(landing): machine d'état de la mini-démo produit`

### Task 2 : cadre, indicateur, scène ① et intégration au hero

**Files :**
- Create : `src/features/landing/product-tour/use-timeline.ts`
- Create : `src/features/landing/product-tour/product-tour.tsx` (`"use client"`)
- Create : `src/features/landing/product-tour/scene-client-order.tsx`
- Modify : `src/features/landing/home-landing.tsx:170-176` (hero : `ProductShot` → `<ProductTour />`)
- Modify : `src/app/globals.css` (keyframes préfixées `product-tour-…` à côté de `home-landing-reveal`, plus leur neutralisation dans le bloc `prefers-reduced-motion`)
- Test : `tests/landing-product-tour.test.ts`

**Interfaces :**
- Consumes : tâche 1.
- Produces :
  - `type SceneProps = { onDone: () => void; reducedMotion: boolean; interacted: boolean }` (exporté par `product-tour.tsx`) ; `interacted` vaut vrai dès le premier geste du visiteur, pour autoriser le déplacement du focus
  - `useTimeline(durationsMs: readonly number[], reducedMotion: boolean): number` — renvoie la phase courante (0 … `durationsMs.length`) ; chaque phase avance après sa durée ; en mouvement réduit, saute directement à la dernière ; nettoie tous ses minuteurs au démontage ou quand `durationsMs` change
  - `usePrefersReducedMotion(): boolean` dans `use-timeline.ts` (réutiliser un hook existant du dépôt s'il y en a un : `grep -rn "prefers-reduced-motion" src`)
  - `<ProductTour />` sans props
  - `GESTURE_RESULT_DELAY_MS = 900` (pause entre le résultat d'un geste et `onDone`), exporté par `use-timeline.ts`

Comportement du cadre : même gabarit que `ProductShot` (bordure, ombre, trois pastilles), puis une barre d'onglets avec l'indicateur ① Client ② Admin ③ Livreur ④ Suivi (boutons ; étapes au-delà de `reached` désactivées ; `aria-current="step"` sur l'étape courante). Ensuite un `<p aria-live="polite" className="sr-only">` qui annonce l'étape, puis la scène courante dans une zone de hauteur fixe (`h-[420px] sm:h-[460px]`), avec `key` = étape pour rejouer la scène au retour arrière.

Scène ① : `useTimeline([400, 500, 500, 400])` remplit retrait, livraison, créneau ; puis le bouton « Commander » pulse (classe `product-tour-pulse`) avec l'indice « Cliquez pour commander ». Au clic, le bouton se désactive, « Commande #1042 envoyée » s'affiche, puis `onDone` est appelé après `GESTURE_RESULT_DELAY_MS`.

- [ ] **Step 1 : test statique qui échoue** : `home-landing.tsx` importe `ProductTour` et ne référence plus `produit-tableau-de-bord.webp` ; il référence toujours `produit-carte.webp`
- [ ] **Step 2 :** `node --import tsx --test tests/landing-product-tour.test.ts` → FAIL sur ce test
- [ ] **Step 3 :** implémenter les fichiers ci-dessus ; les scènes ②–④ restent un simple panneau « Bientôt » avec un bouton qui appelle `onDone`, remplacé en tâches 4 et 5
- [ ] **Step 4 :** relancer → PASS ; puis `npm run check` → exit 0
- [ ] **Step 5 : navigateur** — serveur dev sur un port libre et script Playwright dans le scratchpad, à 1440×900 et 390×844 : la scène ① se remplit, le clic sur « Commander » passe à ②, le clic sur ① dans l'indicateur revient en arrière, ② reste accessible, ④ est désactivé ; double clic rapide = une seule étape ; `document.activeElement` est `body` après chargement ; `scrollWidth <= innerWidth` sur mobile ; captures dans le scratchpad. Arrêter le serveur.
- [ ] **Step 6 :** commit `feat(landing): cadre de la mini-démo et scène commande client`

### Task 3 : géométrie du trajet et plan SVG

**Files :**
- Create : `src/features/landing/product-tour/city-route.ts`
- Create : `src/features/landing/product-tour/city-map.tsx`
- Test : `tests/landing-product-tour.test.ts`

**Interfaces :**
- Produces :
  - `type Point = { x: number; y: number }`
  - `pointAlongRoute(route: readonly Point[], t: number): Point` — position à la fraction `t` de la longueur totale (t borné à [0, 1]) ; route d'un seul point → ce point
  - `TOUR_ROUTE: readonly Point[]` (coordonnées dans un `viewBox="0 0 400 300"`, de l'entrepôt au sud-est vers la Roquette au nord, au moins 4 segments suivant les rues dessinées)
  - `<CityMap progress={number} showRoute={boolean} variant="driver" | "client" />` — rues, Seine, îlots en tons Menthe ; trajet surligné en vert si `showRoute` ; marqueur à `pointAlongRoute(TOUR_ROUTE, progress)` ; épingles de départ et d'arrivée ; `role="img"` avec un `aria-label` en français

- [ ] **Step 1 : tests qui échouent** : route `[{0,0},{10,0},{10,10}]` → t=0 donne `{0,0}`, t=1 `{10,10}`, t=0.5 `{10,0}`, t=0.25 `{5,0}`, t=-1 `{0,0}`, t=2 `{10,10}` ; route à un point → ce point ; `TOUR_ROUTE.length >= 5`
- [ ] **Step 2 :** lancer → FAIL
- [ ] **Step 3 :** implémenter (longueurs cumulées, interpolation linéaire sur le segment concerné)
- [ ] **Step 4 :** lancer → PASS ; `npm run check` → exit 0
- [ ] **Step 5 :** commit `feat(landing): plan SVG et trajet de la mini-démo`

### Task 4 : scènes ② dispatch et ③ livreur

**Files :**
- Create : `src/features/landing/product-tour/scene-dispatch.tsx`
- Create : `src/features/landing/product-tour/scene-driver.tsx`
- Modify : `src/features/landing/product-tour/product-tour.tsx` (brancher les deux scènes)

**Interfaces :**
- Consumes : `SceneProps`, `useTimeline`, `GESTURE_RESULT_DELAY_MS` (tâche 2) ; `TOUR_ORDER`, `TOUR_DRIVERS`, `TOUR_DISPATCH_REASON` (tâche 1) ; `CityMap` (tâche 3).

Scène ② : mini-board avec des colonnes « Sans livreur » et « À démarrer ». La carte #1042 glisse en ambre dans « Sans livreur », puis le bouton « Lancer le dispatcher intelligent » pulse. Au clic, les trois livreurs de `TOUR_DRIVERS` sont examinés un par un (~450 ms chacun). Chaque ligne affiche une coche ou une croix et sa raison. Karim est mis en avant avec « Retenu · Zone « Paris Est » », la carte passe en bleu dans « À démarrer » avec « Karim », puis `onDone`.

Scène ③ : cadre téléphone centré (largeur ~240 px). Une notification « Nouvelle mission · #1042 » descend, puis le détail retrait → livraison et le créneau, et « Démarrer la navigation » pulse. Au clic, la vue passe sur `<CityMap variant="driver" showRoute progress={0} />` avec un bandeau de consigne (« Dans 300 m, tournez à gauche »), puis `onDone`.

- [ ] **Step 1 :** implémenter les deux scènes et les brancher
- [ ] **Step 2 :** `npm run check` → exit 0
- [ ] **Step 3 : navigateur** (1440 et 390) : ① → ② → ③ uniquement par les gestes ; le dispatcher affiche les trois verdicts puis Karim ; revenir à ② depuis ③ la rejoue ; changer d'étape pendant l'examen des livreurs ne fait pas avancer la démo toute seule ; aucun débordement sur mobile ; captures.
- [ ] **Step 4 :** commit `feat(landing): scènes dispatch intelligent et livreur de la mini-démo`

### Task 5 : scène ④ suivi, rejouer, finitions et suivi TODO

**Files :**
- Create : `src/features/landing/product-tour/scene-tracking.tsx`
- Modify : `src/features/landing/product-tour/product-tour.tsx`
- Modify : `TODO.md` (ligne de suivi de la mini-démo, format des lignes GROWTH)

**Interfaces :**
- Consumes : tout ce qui précède ; `restartTour` (tâche 1).

Scène ④ : vue client avec `<CityMap variant="client" showRoute progress={p} />`, où `p` va de 0 à 1 en ~6 s (`requestAnimationFrame`, annulé au démontage ; en mouvement réduit, p = 1 tout de suite). L'ETA va de « 12 min » à « Arrivé ». La timeline montre Commandée ✓, Attribuée à Karim ✓, En route (actif), puis Livrée. À l'arrivée : « Livré ✓ », les boutons « Rejouer » (→ `restartTour`) et « Voir la démo complète » (lien `/demonstration`).

- [ ] **Step 1 : test statique** : `scene-tracking.tsx` contient `href="/demonstration"` (le test des parcours publics le couvre déjà s'il parcourt ce dossier, sinon l'ajouter dans `tests/landing-product-tour.test.ts`)
- [ ] **Step 2 :** implémenter la scène et la brancher ; `npm run check` → exit 0
- [ ] **Step 3 : navigateur** — parcours complet ① → « Livré ✓ » → « Rejouer » → ① vide, à 1440 et 390. Puis avec `reducedMotion: "reduce"` (option Playwright) : les états apparaissent sans animation et le parcours reste faisable. Vérifier aussi qu'il n'y a aucune erreur console ; captures finales.
- [ ] **Step 4 :** ajouter la ligne de suivi dans `TODO.md`, lancer `npm run todo:progress`, vérifier dans `.cursor/rules/contexte-markdown.mdc` si `TODO.md` doit partir sur `preproduction` (sinon ne rien pousser)
- [ ] **Step 5 :** commit `feat(landing): suivi client et fin de parcours de la mini-démo`
