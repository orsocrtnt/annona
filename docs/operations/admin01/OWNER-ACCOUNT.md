# Compte propriétaire de la plateforme

L'inscription publique crée un administrateur d'entreprise. Elle ne crée pas le responsable plateforme.

Le compte propriétaire se crée uniquement par `npm run platform:create-owner`, sur la préproduction autorisée. La commande refuse une autre cible. Elle lit `PLATFORM_OWNER_EMAIL` et `PLATFORM_OWNER_PASSWORD` dans l'environnement du processus. Elle n'affiche pas le mot de passe.

Le compte créé a le rôle `SUPER_ADMIN`, le statut `ACTIVE`, et aucune entreprise. Un second compte de ce rôle est refusé. Si la ligne locale échoue, l'utilisateur d'authentification créé dans la même tentative est retiré.

Ensuite :

1. Ouvrir `/login`.
2. Saisir l'e-mail et le mot de passe de ce compte.
3. La connexion ouvre `/admin`.
4. Les consultations sensibles de cet espace sont journalisées.

Chaque consultation d'une route plateforme écrit le journal d'accès déjà en place. Cette commande ne crée pas d'entreprise, n'envoie pas d'e-mail et ne change pas l'inscription publique.
