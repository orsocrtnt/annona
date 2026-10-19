# MAP-1 — Chargement Leaflet et rendu responsive

15 octobre 2026. Travail local sur TutelLiv GPT ; modifications préexistantes préservées. Aucune base consultée ou modifiée.

## Défauts observés et corrections

Le harnais Next 15 utilise les composants réels et reproduit le rendu serveur des Client Components. Avant correction, `GET /dashboard` renvoie **500** avec `ReferenceError: window is not defined`, chaîne `dashboard-map-widgets → drivers-live-map → leaflet/dist/leaflet-src.js`. Charger seulement le fond dynamiquement ne protège pas les imports Leaflet des marqueurs et de leurs parents.

Les deux widgets et `PortalDeliveriesMap` chargent désormais leurs composants cartographiques avec `next/dynamic`, `ssr:false`. Les imports de types restent effacés à la compilation. Les cartes dispatch et navigation étaient déjà dynamiques depuis les travaux précédents.

La recette mobile a aussi montré une destination client hors écran : le panneau de 300 px réservait une marge gauche d’environ 340 px sur une carte de 390 px. `getMapLayoutPadding` distingue désormais un panneau large flottant (réserve supérieure) d’un panneau latéral desktop (réserve gauche), avec marges latérales proportionnées et hauteur réservée bornée lorsque la liste est ouverte. Après correction, les trois marqueurs client sont visibles à x≈79/195/312 sur 390 px. Le badge de référence admin, redondant avec le panneau mobile, n’en chevauche plus le titre.

## Vérifications

- `npm run check` final : types OK, lint sans erreur avec 24 avertissements préexistants, **168/168 tests** réussis.
- Cinq tests ajoutés : import des widgets et de la carte client sans `window` ; cadrage mobile, desktop/panneau masqué et panneau déplié. Ces tests vérifient des propriétés SSR et géométriques ; ils ne remplacent pas la recette navigateur.
- `npm run build` final, après les corrections responsive : réussi, **96 pages** générées. Le harnais possède son propre `.next`, aucun serveur de développement du dépôt ne partageait le cache du build.
- `git diff --check` réussi.
- Ouvertures SSR directes finales `/dashboard`, `/admin`, `/drivers`, `/portal`, `/navigation` dans le harnais : **200** pour les cinq routes, contre 500 avant correction du chargement.
- Navigations internes Next Link entre ces vues, rechargements directs, sélection d’une livraison admin, ouverture/fermeture des panneaux mobiles, zoom admin et rendu des marqueurs testés dans le navigateur CUA.
- Formats **1280×720 et 390×844** : deux cartes de widgets de 280 px, cartes pleine largeur dans les autres vues ; aucun débordement horizontal constaté. Trois marqueurs sur cartes de livraison, un livreur sur carte livreurs, deux marqueurs et ligne sur navigation chauffeur. La carte client desktop mesure 1280×672 et mobile 390×796 dans ce harnais avec barre de liens de 48 px.
- Session navigateur neuve finale client → navigation : **aucune erreur console**, conservée dans `outputs/map1/final-browser-errors.json`.

Captures desktop/mobile sous `outputs/map1/captures/`. Les captures navigation montrent volontairement le défaut fournisseur restant : elles ne prétendent pas qualifier ses tuiles à ce zoom.

## Harnais et reproductibilité

Sources archivées sous `outputs/map1/harnais/`, suffixe `.txt` pour ne pas intégrer les fixtures au typage applicatif. Reconstituer un dossier temporaire avec `package.json`, `next.config.js`, `postcss.config.mjs`, `fixtures.tsx`, `app/layout.tsx`, `app/harness.css`, `app/[view]/page.tsx` en retirant les suffixes. Adapter `root` et les chemins CSS si le projet a changé de place, puis lier les `node_modules` installés du dépôt et lancer `npm run dev` depuis ce dossier. Port local 4318.

Les pages montent les widgets réels, les pages dispatch carte/livreurs réelles, `PortalDeliveriesMap` et `DriverNavigationScreen`, dans une enveloppe Next minimale. CSS de l’application réel, avec `@source` supplémentaire pour scanner les composants externes. Hooks de lecture, position GPS, wake lock et itinéraire substitués par fixtures locales identifiables MAP-1 ; composant d’accusé de prise en charge substitué par null. Tuiles publiques réellement chargées ; aucun identifiant ni secret de l’application utilisé. Le premier brouillon d’itinéraire simulé n’avait pas le champ `polyline` attendu et a déclenché une erreur du harnais ; fixture corrigée puis recette rejouée dans une session neuve sans erreur.

## Limites et suite

Cette preuve porte sur SSR/hydratation, composants, interactions et cadrage, pas sur les accès/authentifications ni l’enveloppe complète des espaces connectés. Elle ne valide ni GPS physique, appareils iOS/Android, qualité d’itinéraire réel ni politique commerciale des fonds. R06/R07/R08 restent ouverts selon leurs critères propres.

Au zoom chauffeur, les tuiles Esri affichent **« Map data not yet available »** dans les deux formats. Ce défaut est reproduit et consigné dans **MAP-2**, qui conserve fournisseur, niveaux de zoom couverts, attributions, délais, quotas/coûts et faux itinéraire de durée zéro. MAP-1 clôt le chargement et les scénarios de rendu validés ; il ne clôt pas MAP-2.

Aucune migration, seed/reset, donnée distante, push, déploiement ou dépense. Serveur de recette temporaire arrêté après validation. TODO et copies de partage synchronisées après vérification. Prochaine tâche : MAP-2.
