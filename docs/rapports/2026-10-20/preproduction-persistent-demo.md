# Démo permanente de préproduction — 20 octobre 2026

## Résultat

La nouvelle cible Supabase isolée contient désormais un unique compte de connexion de démonstration et une entreprise modèle permanente. Le modèle comprend huit utilisateurs applicatifs et huit livraisons fictives. Il n'est jamais utilisé directement comme espace de travail : chaque navigateur reçoit une société de session distincte avec son propre roster et son propre scénario.

La déconnexion appelle une route serveur avant de fermer la session Supabase. Cette route ne peut cibler que la société résolue depuis le cookie HTTP-only du compte de démo authentifié. La suppression reste fermée si les marqueurs de rétention, le roster synthétique, les frontières d'entreprise, les tâches en cours ou les objets externes ne correspondent pas exactement. L'appel est envoyé en arrière-plan afin que la lenteur de Supabase ne bloque pas l'utilisateur.

Fermer l'onglet ne supprime rien immédiatement, car ce signal est aussi produit par un rechargement, un crash ou une navigation. La société devient toutefois inaccessible après huit heures. Le lot de suppression des expirations existe, mais son horaire n'est pas encore activé sur la Preview.

## CI et protection du modèle

Le montage de recette accepte seulement une cible vide ou le modèle permanent exact. Si le modèle existe, son identifiant Auth, son entreprise, son roster et l'absence d'objets Storage sont contrôlés avant le test. Le manifeste de recette note que le modèle doit être conservé. Le nettoyage retire ensuite uniquement les sociétés créées par l'exécution et vérifie que le modèle est resté strictement identique.

## Preuves

- environnement de préproduction et protections publiques conformes ;
- modèle observé : une société, huit utilisateurs applicatifs, un utilisateur Auth ;
- montage CI avec `persistentBaseReused: true` ;
- nettoyage CI avec `persistentBasePreserved: true` et aucune société supprimée lorsque la recette n'a créé aucune session ;
- connexion HTTP réelle réussie avec persona administrateur dans une société dont le slug porte le préfixe de session ;
- déconnexion HTTP réelle en 204, suivie du retour exact au seul modèle permanent ;
- 280 tests locaux, types, lint, diff-check et build de 103 pages réussis avant le déploiement.

## Limite de performance

Sur la connexion Supabase Free observée, la première création distante de huit livraisons a pris environ 83 secondes et sa suppression protégée environ 39 secondes. La déconnexion cliente n'attend pas cette suppression. La création initiale reste une régression P0 à optimiser avant de rendre la démo publique. Ces mesures ne constituent pas un test de charge.

L'ancienne cible Supabase et ses 51 démonstrations n'ont reçu aucune mutation.
