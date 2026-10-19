# TutelLiv — SEC-03 : droits mini-admin

27 septembre 2026 — correction locale, non déployée.

La gestion des mini-admins est désormais réservée à COMPANY_ADMIN et SUPER_ADMIN. Le contrôle est dans le service serveur ; cacher les boutons ne constitue pas la protection. Les routes utilisent le rôle de la session, jamais celui envoyé dans le corps de la requête.

- MINI_ADMIN, même avec Gestion des comptes : ne peut pas créer un mini-admin, modifier ses propres accès, modifier un autre mini-admin ou supprimer ce dernier. Les refus correspondants sont traduits en HTTP 403.
- COMPANY_ADMIN : gère les mini-admins de sa propre entreprise ; entreprise absente ou étrangère refusée.
- SUPER_ADMIN : conserve la gestion interentreprises prévue par le produit.
- CLIENT / DRIVER : restent exclus des routes de gestion par la garde existante ; le service refuse aussi leur délégation de droits mini-admin.
- Réglages absents, vides ou inconnus : aucun module et aucune permission implicite. Les doublons sont éliminés.
- Création dans l’interface : aucun module précoché, sélection explicite. Un mini-admin ne voit plus les actions de gestion des mini-admins.

## Vérification

`npm run check` réussi : TypeScript OK, lint sans erreur (24 avertissements préexistants), 28 tests réussis dont 12 nouveaux tests SEC-03. `git diff --check` réussi.

Les tests exécutent le vrai service métier avec Prisma simulé. Deux tests exécutent le code réel des routes après compilation en mémoire, avec identité simulée et vrai service métier : refus 403 pour soi, un pair, la création et la suppression ; succès 200 pour l’administrateur autorisé ; 404 pour une cible étrangère.

La création autorisée est vérifiée jusqu’au contrôle d’un e-mail existant. Aucune création Supabase, connexion réelle, écriture distante ou manipulation de compte privilégié n’est effectuée. Le premier passage a exposé un problème de contexte `Error` dans le simulateur de routes ; il a été corrigé et toute la suite relancée avec succès.

## Limites et suite

La partie mini-admin de R13 est validée localement, pas la recette R13 complète ni un parcours navigateur connecté. Le test distant de privilèges reste non exécuté après le refus d’autorisation antérieur. Aucun changement déployé.

Les retraits de permissions en session et les suspensions restent SEC-04 : le cache actuel peut conserver les permissions pendant 60 secondes et les gardes ne vérifient pas les statuts. La proposition de modification globale a été refusée par le contrôle automatique en raison du risque de bloquer les connexions. Aucun changement SEC-04 appliqué.

Les mini-admins anciens sans modules explicites perdront leurs accès lors de la mise en service du correctif. Un administrateur principal devra choisir leurs accès ; aucune attribution automatique ni migration distante n’a été faite.
