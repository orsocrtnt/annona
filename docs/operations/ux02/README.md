# UX-02 — Recette de la navigation d'inscription

Point de départ : navigateur sans session sur `http://127.0.0.1:3106`.

1. Ouvrir `/register` directement. Le titre « Créer un compte entreprise » et le formulaire doivent apparaître.
2. Ouvrir `/login`, attendre le titre « Connexion », puis cliquer sur « Créer un compte ». L'URL doit devenir `/register` et le formulaire doit apparaître.
3. Revenir en arrière, attendre « Connexion », puis recliquer sur « Créer un compte ».
4. Revenir sur `/login`, attendre au moins une seconde afin d'utiliser le cache chaud, puis recliquer.
5. Revenir sur `/login`, recharger la page et recliquer.
6. Vérifier séparément qu'un clic avec Cmd/Ctrl conserve l'ouverture native dans un nouvel onglet.

La navigation principale entre ces deux pages est volontairement une navigation document. Le lien garde un `href` exploitable avant JavaScript et les clics modifiés ne sont pas interceptés.

Preuve automatisée locale : `outputs/ux02/browser-navigation.json`. La propriété `navigationType: "navigate"` confirme une nouvelle navigation document pour chaque clic ; la capture finale est `outputs/ux02/register-final.png`.
