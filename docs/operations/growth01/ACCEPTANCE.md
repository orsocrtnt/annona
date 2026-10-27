# GROWTH-1 — porte d'acceptation locale

Date : 2026-10-25. Cette porte ne clôt pas GROWTH-1.

## Parcours anonyme vérifiés dans le dépôt

- L'accueil relie Fonctionnalités, Tarifs et Démonstration.
- Ces pages relient l'accueil, l'inscription `/register` et la connexion `/login`.
- Tarifs conserve `plan` et `interval` vers `/register`. L'inscription reprend ce choix seulement sans parcours déjà commencé.
- Les prix de la page tarifs viennent du catalogue actif. Aucun montant n'est écrit dans la page.
- Chaque phrase de Fonctionnalités cite un fichier déjà livré.
- Démonstration ne fait qu'une lecture du compte démo. Elle ne crée ni compte, ni session, ni jeu de données.

## Navigateur déjà exercé sur le serveur local

- Clavier : les liens sont focusables. Entrée ouvre Tarifs, Fonctionnalités et Démonstration depuis l'accueil, et Tarifs depuis Fonctionnalités.
- Mobile 390 px : Tarifs et Fonctionnalités empilent leurs trois blocs. Démonstration tient dans la largeur. Aucun débordement horizontal.

## Manques externes, non disponibles

- Contact (2026-10-27, décision C10) : page publique `/contact`, liée depuis le pied de page des pages Fonctionnalités, Tarifs et Démonstration. `POST /api/contact` accepte nom, e-mail, entreprise et téléphone facultatifs, et un message de 10 à 4 000 caractères. Il refuse tout champ inconnu. Un pot de miel invisible fait recevoir à un robot la même réponse qu'un humain, sans rien écrire. Limites : 3 messages par source et 50 au total par heure glissante (429 avec `Retry-After`). L'adresse IP n'est jamais stockée, seulement une empreinte HMAC. Les messages sont lus par `GET /api/admin/contact-messages`, réservé au super-administrateur, journalisé (`CONTACT_MESSAGES`) et paginé 25/50/100, sans l'empreinte. Recette Chrome sur PostgreSQL local jetable : envoi, double-clic sans doublon, rechargement, retour arrière, e-mail invalide bloqué, 4ᵉ envoi refusé avec message, robot ignoré, 390 px sans débordement. Limites restantes : pas encore d'écran de lecture dans le back-office (API seulement, recette super-administrateur à faire) ; migration `20261027090000_contact_messages` à appliquer sur la préproduction après fusion ; durée de conservation des messages à fixer avec LEGAL-1/DATA-02 ; pas de lien depuis la page d'accueil, qui a son propre pied de page.
- Les informations légales ne sont pas publiées : elles attendent une validation.
- Aucun domaine n'est acheté ni branché. Les pages restent locales.

GROWTH-1 reste ouvert.
