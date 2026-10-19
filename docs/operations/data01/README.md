# DATA-01 — historique et exports de commandes

## Contrat serveur

- Les listes de commandes de l'administration et du portail client utilisent une pagination serveur de 25, 50 ou 100 résultats. La page, la recherche, le statut, le type et les dates sont validés avant toute requête.
- L'ordre est toujours `createdAt DESC`, puis `id DESC`. Ce second critère évite un ordre indéterminé lorsque plusieurs commandes partagent la même date.
- Chaque requête impose l'entreprise authentifiée. Le portail impose en plus le client authentifié et sépare les commandes actives de l'historique terminé.
- La recherche porte sur la référence de commande, le client, l'adresse, la ville et la référence de livraison. Les filtres sont combinés et exécutés en base.

## Exports CSV

- L'export reprend tous les résultats correspondant aux filtres, indépendamment de la page affichée, par lots de 500 commandes.
- L'administration reçoit les champs client ; le portail ne reçoit que les commandes du client connecté.
- Le fichier est privé, non mis en cache et protégé contre l'interprétation des cellules commençant par `=`, `+`, `-` ou `@` comme formules.
- Un export volumineux est construit en mémoire après les lectures par lots. Une limite asynchrone ou un flux devra être envisagé si les volumes réels dépassent nettement la recette de 1 000 commandes.

## Vérification

Lancer `npm run check`, puis `npm run build`. La recette connectée doit créer deux entreprises jetables, 1 000 commandes dans A et quelques commandes dans B, puis contrôler la page la plus ancienne, le tri répété, chaque filtre, les quatre profils admin/client A/B et les exports complets. Elle doit enfin supprimer comptes Auth et données créées et retrouver exactement l'empreinte initiale de la base.
