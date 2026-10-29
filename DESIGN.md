---
name: "TutelLiv — Dashboard entreprise"
description: "Un centre de pilotage lumineux, précis et opérationnel, où le vert signale l’activité réelle."
colors:
  mission-green: "#00D46A"
  operational-ink: "#0E1310"
  paper-canvas: "#F8F9F7"
  structural-mist: "#E4E8E5"
  surface-white: "#FFFFFF"
  surface-muted: "#F3F5F2"
  text-muted: "#68726B"
  success-ink: "#08783F"
  danger-ink: "#A12C2C"
  warning-ink: "#614F22"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  control: "12px"
  card: "16px"
  chrome: "18px"
  rail: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.operational-ink}"
    textColor: "{colors.surface-white}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.operational-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  card-operational:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.operational-ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  nav-active:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.operational-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "44px"
  status-chip:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: TutelLiv — Dashboard entreprise

## Overview

**Creative North Star: "La Ligne de Mission"**

Le dashboard entreprise est un instrument de supervision calme dans un bureau lumineux : un canevas papier cassé, un rail noir flottant et des cartes blanches nettes organisent les données réelles sans bruit décoratif. Le vert TutelLiv ne remplit pas l’écran ; il suit l’activité, marque l’état actif et relie les étapes d’une mission.

La direction associe Apple Glass Light, Bento et Minimal SaaS avec une discipline d’interface d’exploitation. Le verre reste réservé au chrome et aux couches temporaires ; le contenu métier reste opaque, lisible et stable. Cette expression est strictement limitée à `/dashboard` : les écrans adjacents conservent leur monde visuel existant.

**Key Characteristics:**

- Fond papier lumineux et surfaces de données blanches.
- Rail noir flottant et topbar claire translucide.
- Bento asymétrique gouverné par la hiérarchie opérationnelle.
- Vert rare, fonctionnel et directement relié à l’activité réelle.
- Ligne de mission à stations comme signature du suivi par statut.
- Sora, grands chiffres lisibles et microcopie sobre en français.

## Colors

La palette est volontairement courte : un vert d’activité franc, un noir végétal profond, des neutres légèrement chauds et des couleurs d’état réservées aux exceptions métier.

### Primary

- **Vert mission** (`mission-green`): accent d’activité pour la navigation active, les stations, la ligne de mission, les états en ligne et les focus.

### Neutral

- **Encre opérationnelle** (`operational-ink`): texte principal, rail, bouton d’action et carte d’activité dominante.
- **Papier lumineux** (`paper-canvas`): fond exclusif du dashboard entreprise.
- **Brume structurelle** (`structural-mist`): séparation douce et repère de structure.
- **Surface blanche** (`surface-white`): cartes de données et contrôles secondaires.
- **Surface assourdie** (`surface-muted`): contrôles discrets, statuts neutres et états vides.
- **Texte secondaire** (`text-muted`): descriptions, métadonnées et légendes.

### Named Rules

**The Activity-Only Green Rule.** Le vert signale une activité, une sélection, une disponibilité ou un focus réel ; il ne sert jamais de remplissage décoratif.

**The Opaque Data Rule.** Les surfaces qui portent des données restent opaques ; la transparence appartient au chrome et aux overlays.

## Typography

**Display Font:** Sora (avec `ui-sans-serif`, `system-ui`, `sans-serif` en repli)  
**Body Font:** Sora (avec `ui-sans-serif`, `system-ui`, `sans-serif` en repli)

**Character:** Sora apporte une géométrie nette et contemporaine sans perdre la chaleur nécessaire à un outil quotidien. Les titres sont compacts et légèrement resserrés ; le texte courant reste respirant et immédiatement scannable.

### Hierarchy

- **Display** (600, `clamp(2rem, 4vw, 3.25rem)`, 1.02): salutation et unique point d’entrée de la page.
- **Headline** (600, 1.25rem, 1.2): titre de la carte d’activité dominante.
- **Title** (600, 1.125rem, 1.25): titres des panneaux opérationnels et des listes.
- **Body** (400, 0.875rem, 1.5): descriptions, données secondaires et texte de soutien.
- **Label** (600, 0.75rem, 1.35): statuts, périodes, en-têtes de table et métadonnées compactes.

### Named Rules

**The One-Greeting Rule.** Une seule accroche de niveau display ouvre la page ; les modules suivants utilisent headline ou title pour préserver la vitesse de lecture.

## Layout

Le contenu s’inscrit dans un conteneur maximal de 1480px. Sur grand écran, le rail mesure 264px ouvert ou 80px replié, flotte à 12px des bords et laisse au contenu un dégagement de 292px ou 104px. La topbar suit le même conteneur et le contenu utilise une marge interne de 32px ; le rythme vertical principal est de 20 à 24px.

Le Bento est guidé par l’importance : trois KPI en grille, une carte d’activité pleine largeur, puis une zone de planification en deux colonnes avec une dominante de 1.65fr et un panneau secondaire de 0.75fr. Les cartes conservent 16px de rayon et 20 à 24px de padding.

Sous 1024px, le rail disparaît au profit d’un tiroir. Sous 640px, tous les modules s’empilent, les tableaux deviennent des cartes, les groupes d’actions reviennent à la ligne et aucun défilement horizontal n’est requis. Toute cible interactive structurante fait au moins 44px.

**The Dashboard Boundary Rule.** Cette composition, Sora et ce chrome premium s’appliquent à `/dashboard` uniquement ; ne pas propager cette refonte aux routes adjacentes sans décision explicite.

## Elevation & Depth

Le système combine superposition tonale et ombres ambiantes très diffuses. Les cartes de données restent presque plates et se séparent par une bordure noire à faible opacité ; le rail, la topbar, les boutons flottants et la carte sombre dominante reçoivent seuls une élévation notable. Le flou d’arrière-plan est un effet de chrome, jamais un effet de carte métier.

### Shadow Vocabulary

- **Chrome flottant** (`0 12px 44px rgba(14, 19, 16, 0.055)`): topbar translucide.
- **Rail ancré** (`0 22px 65px rgba(14, 19, 16, 0.20)`): navigation latérale premium.
- **Carte dominante** (`0 22px 60px rgba(14, 19, 16, 0.13)`): ligne de mission sur fond sombre.
- **Action levée** (`0 12px 28px rgba(14, 19, 16, 0.18)`): action primaire « Ouvrir le dispatch ».

### Named Rules

**The Chrome-Owns-Glass Rule.** Réserver le verre à la topbar, au tiroir et aux overlays ; le contenu métier ne devient ni transparent ni flou.

## Shapes

Les silhouettes sont généreusement mais systématiquement arrondies : contrôles et lignes internes à 12px, cartes à 16px, topbar à 18px, rail à 24px et actions circulaires ou pilules. Les bordures sont fines et peu contrastées ; elles structurent sans enfermer. La ligne de mission emploie des segments arrondis et des stations circulaires, jamais une iconographie décorative autonome.

**The Measured-Radius Rule.** Le rayon suit la fonction — contrôle, carte, chrome, rail ou pilule — et ne varie pas arbitrairement d’un module à l’autre.

## Components

### Buttons

Les boutons sont calmes, tactiles et directement hiérarchisés.

- **Shape:** pilule pour les actions de page ; rayon de 12px pour les actions internes ; hauteur minimale de 44px.
- **Primary:** fond encre opérationnelle, texte blanc, icône d’activité verte et padding horizontal de 20px.
- **Hover / Focus:** translation verticale de 2px au survol quand le bouton flotte ; focus vert visible à 2px avec offset.
- **Secondary / Ghost:** surface blanche bordée ou surface assourdie, toujours avec texte encre et contraste stable.

### Chips

- **Style:** pilules compactes sur surface assourdie ; les statuts positifs utilisent un fond vert très pâle et une encre verte foncée.
- **State:** la période sélectionnée devient noire sur blanc ; les autres options restent gris-vert et conservent une cible de 44px.

### Cards / Containers

- **Corner Style:** cartes de données à 16px ; modules internes à 12px.
- **Background:** blanc opaque pour les informations ; encre opérationnelle pour la seule carte d’activité dominante.
- **Shadow Strategy:** bordure légère par défaut, ombre ambiante uniquement pour la hiérarchie majeure.
- **Border:** noir à 6.5% environ, avec bordures vertes, rouges ou ambre seulement lorsque l’état métier le justifie.
- **Internal Padding:** 20px sur mobile, 24px sur les grands panneaux.

### Navigation

Le rail est noir, flottant et arrondi. L’item actif est une surface à peine teintée de 44px minimum, bordée d’un filet, avec texte encre et icône verte (sélection) : ni aplat vert ni halo (décision du 29 octobre 2026). Les compteurs sont de simples chiffres gris, sans pastille colorée. Les items inactifs sont blancs à opacité réduite et deviennent pleinement lisibles au survol. Sur mobile, le rail devient un tiroir noir arrondi à droite, déclenché depuis la topbar.

### Ligne de mission

La carte sombre « Répartition par étape » traduit les volumes réels par statut en une ligne verte à stations proportionnelles. Chaque station affiche sa valeur et ouvre le détail correspondant. L’animation de tracé dure 800ms avec une courbe de décélération douce et disparaît avec `prefers-reduced-motion`.

### KPI opérationnel

Chaque KPI occupe une carte blanche d’au moins 148px, associe libellé, grande valeur, détail et pictogramme circulaire. Les états succès et retard colorent seulement la bordure, l’icône et la valeur nécessaire ; toute la carte devient une cible lorsqu’un détail réel existe.

## Do's and Don'ts

### Do:

- **Do** réserver le verre au chrome et garder les cartes de données opaques.
- **Do** utiliser le vert mission uniquement pour une activité, une sélection, une disponibilité ou un focus réel.
- **Do** présenter les données réellement disponibles et permettre le passage direct du résumé au détail.
- **Do** conserver des cibles interactives d’au moins 44px et respecter la réduction de mouvement et de transparence.
- **Do** empiler les modules sur mobile sans défilement horizontal.

### Don't:

- **Don't** inventer une série temporelle, une tendance, une capacité de création ou une donnée absente.
- **Don't** transformer la ligne de mission en carte de métro décorative ou multiplier les accents verts.
- **Don't** appliquer le chrome premium du dashboard aux écrans adjacents sans décision de périmètre explicite.
- **Don't** fabriquer un logo, un monogramme ou une fausse marque en l’absence d’un actif officiel.
- **Don't** employer du verre, des ombres fortes ou des gradients sur les cartes métier ordinaires.
