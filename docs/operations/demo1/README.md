# DEMO-1 — Démonstrations isolées

Une connexion avec le compte de démonstration prépare une entreprise fictive propre au navigateur. Le cookie de session est HTTP-only, valable huit heures et ne contient qu'un identifiant aléatoire. Son empreinte détermine un slug préfixé `logiexpress-demo-session-` ; aucun identifiant de base n'est exposé au navigateur.

Le compte Supabase commun sert uniquement à authentifier l'entrée. Une fois connecté, TutelLiv résout les vues administrateur, client et chauffeur dans l'entreprise de session. Les comptes de ces trois vues ont des identifiants et e-mails techniques propres à cette entreprise.

## Comportement attendu

- un nouveau navigateur reçoit un scénario séparé de huit livraisons ;
- une reconnexion dans le même navigateur réutilise la session et ses modifications ;
- changer de persona reste dans la même entreprise de session ;
- « Réinitialiser la démo » purge et recrée uniquement cette entreprise ;
- une autre démonstration, une entreprise normale et l'entreprise modèle ne sont pas modifiées.

La barre de démonstration indique maintenant « données fictives dans votre session isolée ». La confirmation de reset précise que les autres démonstrations ne seront pas touchées.

## Vérification

- `npm run check` vérifie l'authentification, les personas et la préparation de session dans les routes.
- `npm run test:demo1` crée un modèle fictif et deux sessions simultanées, vérifie les trois personas et huit livraisons dans chacune, ajoute un marqueur A et B, réinitialise A, contrôle que B garde son marqueur, puis réutilise B sans reset.
- Le script supprime ses deux sessions et le modèle de test ; le contrôle final exige zéro entreprise, utilisateur, commande et livraison résiduelle.

Le test ne touche ni au compte de démonstration existant ni à une entreprise normale. Il ne crée aucun utilisateur Supabase et n'envoie aucun message.

## Limites d'exploitation

Les entreprises de session sont conservées après l'expiration du cookie afin d'éviter une suppression implicite pendant le développement. Avant d'ouvrir une démo publique à fort trafic, il faudra définir une rétention et un nettoyage des sessions expirées, avec traitement des éventuels objets Storage. L'isolation fonctionnelle est validée ; la capacité et la conservation relèvent encore de DATA-02 et OPS-03B.
