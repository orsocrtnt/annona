# DEMO-1 — Démonstrations isolées

Une connexion avec le compte de démonstration prépare une entreprise fictive propre au navigateur. Le cookie de session est HTTP-only, valable huit heures et ne contient qu'un identifiant aléatoire. Son empreinte détermine un slug préfixé `logiexpress-demo-session-` ; aucun identifiant de base n'est exposé au navigateur.

Le compte Supabase commun et l'entreprise modèle restent en permanence sur la préproduction. Ils servent uniquement à authentifier l'entrée et à fournir le scénario initial. Une fois connecté, Annona résout les vues administrateur, client et chauffeur dans l'entreprise de session. Les comptes de ces trois vues ont des identifiants et e-mails techniques propres à cette entreprise.

## Comportement attendu

- un nouveau navigateur reçoit un scénario séparé de huit livraisons ;
- une reconnexion dans le même navigateur réutilise la session et ses modifications ;
- changer de persona reste dans la même entreprise de session ;
- « Réinitialiser la démo » purge et recrée uniquement cette entreprise ;
- « Déconnexion » lance le nettoyage de cette entreprise sans ralentir la fermeture de session ;
- à huit heures, la session devient inaccessible et une nouvelle connexion repart du scénario modèle ;
- une autre démonstration, une entreprise normale et l'entreprise modèle ne sont pas modifiées.

La barre de démonstration indique maintenant « données fictives dans votre session isolée ». La confirmation de reset précise que les autres démonstrations ne seront pas touchées.

## Vérification

- `npm run check` vérifie l'authentification, les personas et la préparation de session dans les routes.
- `npm run test:demo1` crée un modèle fictif et deux sessions simultanées, vérifie les trois personas et huit livraisons dans chacune, ajoute un marqueur A et B, réinitialise A, contrôle que B garde son marqueur, puis réutilise B sans reset.
- Le script supprime ses deux sessions et le modèle de test ; le contrôle final exige zéro entreprise, utilisateur, commande et livraison résiduelle.

Le test ne touche ni au compte de démonstration existant ni à une entreprise normale. Il ne crée aucun utilisateur Supabase et n'envoie aucun message.

## Limites d'exploitation

Fermer un onglet ou un navigateur n'est pas un signal fiable : rechargement, crash et changement de page peuvent produire le même événement. Annona ne supprime donc jamais une session sur ce seul signal. La déconnexion explicite demande un nettoyage immédiat en arrière-plan ; l'expiration serveur à huit heures rend ensuite la session inaccessible même si le cookie est rejoué.

Le lot de suppression des sessions expirées est préparé mais son horaire n'est pas encore activé sur la Preview. Les sessions qui ne passent ni par la déconnexion ni par un futur passage du lot peuvent donc rester physiquement présentes après leur expiration. Les sessions comportant des objets Storage ambigus restent volontairement bloquées. La planification, l'observation et le traitement de ces objets relèvent encore de DATA-02 et OPS-03B.

La première création distante du scénario de huit livraisons a pris 83 secondes lors du contrôle du 20 octobre sur Supabase Free, tandis que la suppression protégée a pris 39 secondes. La déconnexion utilisateur n'attend pas cette suppression, mais l'entrée initiale reste une régression de performance à corriger avant une démo publique.
