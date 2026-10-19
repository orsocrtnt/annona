# OPS-01 — Fiabilité des récurrences

Date : 16 octobre 2026. Implémentation et recette sur l'environnement de test autorisé, sans migration ni déploiement.

## Résultat

- L'échéance n'est plus avancée avant la création de la commande. La commande atomique existante devient l'occurrence durable et sa clé récurrence/date garantit l'unicité au rejeu.
- Le worker draine les échéances par lots de 25, jusqu'à 500 par appel. Les erreurs et le reliquat restent visibles dans la réponse du cron ; un état incomplet renvoie `503`.
- Les séries en pause ou annulées ne produisent rien. La fin de période crée la dernière occurrence autorisée puis clôt la série.
- Les dates sont calculées comme dates calendaires UTC. Les fins de mois conservent le jour d'ancrage : 31 janvier → 29 février 2024 → 31 mars.
- Une modification de date de début recale la prochaine occurrence. Une série créée sur sa dernière date se clôt immédiatement après sa première commande.

## Preuves

La suite locale traite 100 échéances simulées en quatre lots, obtient 100 clés uniques et aucune perte. Une panne injectée après la création durable laisse `nextRunAt` inchangée ; le second appel retrouve la même commande et avance une seule fois. Deux contrôles supplémentaires vérifient le secret du cron et les réponses `200/503`.

La recette connectée crée cinq occurrences réelles, puis reproduit l'état « commande créée, échéance non avancée ». Le rejeu conserve une seule commande et avance au 2 janvier. Les récurrences en pause et annulées ne créent aucune commande. Contrôle final : zéro entreprise, utilisateur, récurrence, commande, livraison ou tâche OPS-01 résiduelle. Preuve : `outputs/ops01/connected.json`.

Le premier essai connecté a rencontré une fermeture PostgreSQL `P1017` pendant la transaction de la première occurrence. Le worker a laissé l'échéance rejouable. Après nettoyage ciblé, la recette complète a réussi en 40,7 s et le contrôle final est resté à zéro résidu.

## Limites conservées

Le cron est toujours configuré à 06:00 UTC chaque jour dans `vercel.json`. Son exécution réelle, ses alertes et sa capacité sur l'hébergement de préproduction restent à valider dans CI-1/DB-1. La borne de 500 rend un backlog supérieur explicite avec `hasMore`; l'appelant doit relancer. Aucun fuseau par entreprise ni heure de passage n'est proposé : la V1 promet une date de livraison, pas un créneau horaire récurrent.
