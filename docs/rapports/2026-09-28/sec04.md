# TutelLiv — SEC-04 : suspension et retrait d’accès

28 septembre 2026. Correction locale autorisée explicitement par le propriétaire, non déployée.

## Résultat

- Les gardes serveur relisent le compte, son entreprise et ses permissions à chaque requête. Le cache de permissions partagé entre requêtes (60 secondes) est retiré, ainsi que ses usages dans le mode démo. La déduplication React à l’intérieur d’une requête est conservée.
- Seul un compte ACTIVE est admis. Son entreprise doit être ACTIVE ou TRIAL, et correspondre à son companyId. Un SUPER_ADMIN actif peut être sans entreprise ; les autres rôles ne le peuvent pas.
- Le compte de connexion démo et la persona sélectionnée sont contrôlés. Un changement de persona ou une réinitialisation visant un administrateur suspendu est refusé avant mutation.
- La synchronisation d’un compte existant suspendu est refusée avant modification du profil ou rattachement de commandes, y compris lorsqu’il est retrouvé par e-mail.
- Connexion et synchronisation renvoient 403 pour un compte/une entreprise indisponible. Les gardes protégées renvoient 401 si le contexte de compte est refusé, et 403 si une permission a été retirée.

## Preuves

`npm run check` réussi : types OK, lint sans erreur avec 24 avertissements préexistants, 39 tests réussis dont 11 nouveaux dans tests/account-access.test.ts. `git diff --check` réussi.

Scénarios exécutés localement :

1. Matrice de 16 combinaisons de statut utilisateur/entreprise.
2. Entreprise manquante, incohérente et exception du super-admin sans entreprise.
3. Retrait d’un module après une première autorisation sur deux instances isolées du résolveur : refus à la requête suivante sur les deux instances, sans temporisation ; autre module conservé.
4. Suspension, réactivation, suspension d’entreprise et disparition du compte après session autorisée.
5. Erreur de lecture après succès : aucune autorisation périmée réutilisée.
6. Chemin de repli Supabase et synchronisation refusée.
7. Compte de connexion démo suspendu ou persona suspendue.
8–9. Service réel de synchronisation : refus avant écriture pour un compte retrouvé par authId puis par e-mail.
10. Code réel des routes de connexion/synchronisation : actif accepté, compte suspendu et entreprise inactive refusés.
11. Code réel des routes démo : persona suspendue et reset avec administrateur suspendu refusés sans mutation.

Les services et routes sont exécutés avec leurs entrées/sorties externes simulées ; les modules serveur sont compilés en mémoire. Dans ce simulateur, chaque appel représente une nouvelle requête ; il ne vérifie pas le cache React dans un vrai serveur Next. Aucun E2E navigateur, test de charge, suspension distante ni déploiement effectué.

## Délai et limites

Une modification validée en base est relue par toute nouvelle requête qui passe par ces gardes, sans délai TTL applicatif. Une requête déjà autorisée peut terminer ; cette correction ne l’annule pas. Une panne de lecture produit une erreur, sans réutiliser une ancienne autorisation.

Les écrans déjà ouverts et leurs données déjà reçues ne sont pas effacés à distance. La révocation des jetons Supabase, les accès directs Storage et toutes les routes hors de ces gardes nécessitent la suite SEC-05/06. R13 reste ouverte pour la recette complète.

Le retrait du cache augmente les lectures en base : le coût sous charge reste à mesurer. Les comptes anciens sans entreprise valide seront refusés ; aucune réparation automatique n’a été appliquée. Le build production et le parcours navigateur connecté restent à vérifier avant déploiement.

## Suite

SEC-05 : invitations et récupération sécurisées, en lien avec EMAIL. SEC-06 : frontières d’accès, fichiers et politiques réellement déployées. Les acquis SEC-01/02/03 sont conservés.
