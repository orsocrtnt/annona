# DATA-01 — historique complet et exports cloisonnés

14 octobre 2026 — implémentation locale et recette connectée sur l'environnement de test, sans déploiement ni changement de schéma.

## Résultat

Les listes de commandes de l'administration, des commandes actives du client et de son historique utilisent désormais la pagination, la recherche et les filtres côté serveur. La recherche couvre référence, client, adresse, ville et référence de livraison. Les filtres de statut, type et dates sont combinables. Le tri `createdAt DESC, id DESC` est commun aux pages et aux exports.

Les trois écrans présentent les filtres, le nombre total, la page courante et les commandes précédente/suivante. L'export CSV reprend le résultat filtré complet sans tenir compte de la page affichée. Il est généré par lots de 500, limité à l'entreprise authentifiée et, sur le portail, au client connecté. Les cellules susceptibles d'être interprétées comme des formules sont neutralisées.

Le rattachement historique d'un client par e-mail exige maintenant aussi la même entreprise. Cela supprime une possibilité de résolution ambiguë si deux entreprises utilisent la même adresse e-mail dans leurs anciennes données.

## Vérifications

- `npm run check` : types valides, lint sans erreur avec 24 avertissements historiques, 152 tests réussis sur 152, dont 4 nouveaux tests DATA-01.
- `npm run build` : compilation de production réussie.
- Recette connectée : 1 000 commandes terminées dans A et 7 dans B. L'administration A et le client A retrouvent la plus ancienne en page 20 sur 20 ; une seconde lecture rend les mêmes identifiants dans le même ordre.
- Recherche, statut, catégorie et dates sont exécutés côté serveur. Un paramètre invalide renvoie 400 et l'accès anonyme 401.
- Les exports admin A et client A contiennent exactement l'en-tête et 1 000 commandes, de la plus récente à la plus ancienne. Les exports de B contiennent seulement ses 7 commandes. La recherche exacte d'une référence A depuis B retourne zéro résultat.
- Nettoyage : les deux entreprises, quatre comptes base/Auth et 1 007 commandes de recette ont été supprimés. Comptes et empreinte SHA-256 des entreprises, utilisateurs, commandes et livraisons préexistants identiques avant/après.

## Limites

La preuve porte sur 1 000 commandes et un export CSV construit en mémoire après lectures par lots. La charge simultanée de plusieurs exports beaucoup plus volumineux n'est pas qualifiée. Aucun index ni schéma n'a été ajouté ; les mesures de charge et la stratégie de rétention restent dans DATA-02/SAAS-02. Les avertissements lint préexistants et les essais sur appareil réel restent suivis dans leurs tâches dédiées.

Preuves : `outputs/data01/connected-final.json`, `outputs/data01/check-final.log`, `outputs/data01/build-final.log`.
