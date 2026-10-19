# UI-2 — Lisibilité et accessibilité des parcours essentiels

Date : 16 octobre 2026. Périmètre : espaces administrateur, client et chauffeur sur les parcours commande, dispatch, suivi et mission. La recette utilise les données de démonstration en lecture seule et ne crée ni ne modifie aucune donnée métier.

## Diagnostic initial

L'audit mobile à 390 × 844 px a relevé un débordement global de 163 px sur le tableau de bord administrateur. Les liens d'alerte opérationnelle mesuraient jusqu'à 528 px à cause d'un texte forcé sur une ligne. Les écrans n'offraient pas de lien d'évitement, certains espaces n'avaient pas de repère `main`, le menu mobile ne piégeait pas le focus et plusieurs états actifs n'étaient pas annoncés. Les sélecteurs de statut ou de chauffeur, des boutons icônes et le champ d'adresse principal manquaient aussi de noms correctement reliés.

Le formulaire client affichait des erreurs, mais toutes n'étaient pas associées au contrôle qui les provoquait. Les choix de catégorie et d'adresse ne communiquaient pas leur état sélectionné. Le rouge précédent n'atteignait pas le contraste AA pour un petit texte. La préférence de réduction des animations n'était pas appliquée globalement.

## Corrections

- Un lien « Aller au contenu principal » précède désormais l'interface et cible un unique contenu principal sur les espaces public, authentification, administrateur, client et chauffeur.
- Le menu mobile utilise une fenêtre accessible : focus contenu, fermeture avec Échap, arrière-plan neutralisé et retour du focus au bouton d'ouverture.
- Les navigations exposent leur page active ; les boutons icônes, tris, paginations, sélecteurs et actions de mission ont un nom explicite et un focus visible.
- Les erreurs de formulaire sont reliées par `aria-describedby`, annoncées comme alertes et les champs requis sont identifiés. Les catégories et onglets exposent leur sélection ; le champ d'adresse garde un identifiant unique et un vrai libellé.
- Les alertes longues passent à la ligne, les petits compteurs atteignent une cible utilisable et les tables restent contenues dans une zone de défilement locale.
- Le suivi partagé annonce le chargement, tient dans la largeur mobile et sa fenêtre est bornée à la hauteur disponible. Les écrans carte disposent d'un titre accessible.
- Les couleurs d'erreur, succès et avertissement ont été renforcées en conservant les noms de tokens existants. Une règle réduit les animations lorsque le système le demande.

## Validation

L'audit Chrome final couvre huit écrans à 390 × 844 px. Chaque écran possède exactement un contenu principal et un titre accessible. Le débordement global est de 0 px partout ; aucun contrôle sans nom, champ sans libellé ou cible isolée sous 24 px n'est détecté. Le lien d'évitement est le premier focus et atteint le contenu principal sur les huit écrans.

Le parcours interactif confirme le piège de focus du menu, sa fermeture par Échap et le retour du focus. La soumission vide présente quatre alertes reliées, quatre champs invalides et place le focus sur un champ invalide. Le suivi partagé ne déborde pas horizontalement, expose une mission et un statut ; la fenêtre de suivi chauffeur tient dans le viewport. Les six actions visibles de la page Missions sont nommées et correctement dimensionnées. En mode réduction des animations, les durées mesurées tombent à 0,00001 s.

Contrastes mesurés : texte principal/fond 18,97:1 ; texte secondaire/fond 4,63:1 ; marque/carte et blanc/marque 4,83:1 ; erreur/fond erreur 5,91:1 ; succès/fond succès 5,21:1 ; avertissement/fond avertissement 4,84:1. Tous les couples de petit texte testés atteignent AA.

- `npm run check` : types valides, lint sans erreur bloquante et **214/214 tests réussis**.
- `npm run build` : réussi, **96 pages** générées.
- `git diff --check` : réussi.
- Preuves : `outputs/ui2/browser-audit.json`, `outputs/ui2/browser-interactions.json` et les quatre captures PNG du même dossier.
- Protocole reproductible : `docs/operations/ui2/README.md`.

Les essais couvrent Chrome local et un viewport mobile simulé. MOB-01C reste nécessaire pour qualifier l'usage sur iPhone et Android physiques, notamment le clavier virtuel, le GPS, le verrouillage d'écran et le retour d'arrière-plan.
