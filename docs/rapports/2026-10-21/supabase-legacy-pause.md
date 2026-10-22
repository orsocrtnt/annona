# Mise en pause de la cible Supabase historique

Date : 21 octobre 2026  
Projet historique : `wlomrzilflbouzyhzwxm`  
Résultat : projet en pause, aucune suppression

## Décision

Le propriétaire a confirmé que les quatre entreprises non marquées comme démo et toutes les anciennes sessions présentes sur cette cible contiennent uniquement des données fictives. La nouvelle préproduction possède déjà sa propre démonstration permanente ; les anciens jeux ne sont pas nécessaires à son fonctionnement.

## Inventaire final avant pause

L'inventaire connecté a été exécuté en lecture seule et sans publier d'identifiant :

- cinquante-sept entreprises au total ;
- cinquante-trois entreprises de démonstration ;
- cinquante-deux anciennes sessions sans règle de rétention persistée ;
- une société démo de base ;
- quatre entreprises marquées normales, confirmées fictives par le propriétaire ;
- zéro mutation pendant l'inventaire.

La preuve agrégée est conservée sous `outputs/data02/demo-legacy-inventory.json`. Le passage de cinquante-et-une à cinquante-deux sessions depuis l'inventaire du 19 octobre correspond à une session supplémentaire créée entre les deux lectures ; aucune conclusion métier n'est attachée à ces jeux synthétiques.

## Mise en pause

La mise en pause a été demandée depuis les réglages du projet Supabase. Le tableau de bord a d'abord affiché « Project is pausing », puis « Project is paused ». Le projet n'a pas été supprimé : ses données restent récupérables selon la fenêtre indiquée par Supabase.

Cette pause libère un emplacement actif du plan Free. Il pourra accueillir la cible temporaire nécessaire à l'exercice fournisseur d'OPS-03A.

Suivi du même jour : l'emplacement a bien servi à créer `tutelliv-restore-rehearsal`. L'export base + Auth + Storage y a été restauré et contrôlé avec succès. Voir `docs/rapports/2026-10-21/ops03a-provider-restore.md`.

## Contrôle de la préproduction

Après la demande de pause, la cible `zwwyalsslyydubtetagj` a été contrôlée séparément :

- garde d'isolation réussie ;
- vingt tables applicatives et deux migrations attendues ;
- zéro drift Prisma ;
- RLS sur toutes les tables ;
- six rôles, trente-trois permissions et cent neuf liaisons conformes ;
- bucket de preuves privé et types MIME restreints ;
- une démo permanente, trois sessions temporaires valides et un utilisateur Auth ;
- aucun accès à la cible historique nécessaire.

Aucune donnée n'a été supprimée, aucun paiement n'a été déclenché et la production Git/Vercel n'a pas été modifiée.
