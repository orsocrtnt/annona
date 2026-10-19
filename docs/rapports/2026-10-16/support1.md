# SUPPORT-1 — Boucle de support client

Date : 16 octobre 2026. Périmètre : réception d'une demande client par l'équipe, réponse, historique, notifications, résolution, réouverture et isolation entre entreprises.

## Situation initiale

Le portail permettait déjà au client de créer un ticket, mais l'équipe ne disposait pas d'une boîte de réception exploitable. Il n'existait pas de parcours complet et prouvé pour répondre, modifier le statut, notifier le client et lui montrer la résolution. L'ancien parcours de réponse client était isolé de cette boucle opérationnelle.

## Réalisation

- Un espace `/support` regroupe les demandes de l'entreprise, avec filtres, identité du client, liens métier autorisés, historique, réponse et changement de statut.
- Le portail client possède désormais un détail de ticket avec historique, statut et réponse. Une réponse client rouvre une demande résolue ou fermée.
- Les réponses de l'équipe et les changements de statut créent des notifications intégrées de type `SUPPORT` qui renvoient au bon ticket.
- La navigation, le middleware et les permissions mini-administrateur connaissent le module Support. Administrateurs et dispatchers ont accès à la boîte de réception ; les autres rôles sont refusés.
- Les validations bornent et nettoient sujets, messages et statuts. Toutes les lectures et écritures combinent entreprise, propriétaire et ressources liées.
- Une concurrence découverte pendant la recette pouvait laisser une réponse tardive ramener un ticket déjà résolu à `En cours`. La transition automatique utilise maintenant une mise à jour conditionnelle `Ouvert → En cours` : une résolution concurrente gagne et ne peut plus être rétrogradée.

Le canal annoncé dans le produit est cet espace TutelLiv, avec un objectif de première réponse sous un jour ouvré. Les e-mails restent une tâche séparée et aucun délai contractuel n'est revendiqué.

## Résultats

- **217/217 tests locaux** réussis, dont les frontières d'entreprise, la transaction réponse/notification, l'idempotence de statut et la concurrence réponse/résolution ;
- recette connectée réussie sur **2 entreprises temporaires** : réception, réponse, notification, résolution, réouverture et isolement vérifiés ;
- **zéro résidu** entreprise, utilisateur, ticket, message ou notification après nettoyage ;
- recette Chrome réussie : création client, réception équipe, réponse, statut résolu et notifications visibles ;
- accès client vers l'API équipe et chauffeur vers le ticket client refusés à **403** ;
- suite navigateur globale réussie : **2/2 scénarios** SUPPORT-1 et TEST-2 ;
- `npm run check` réussi, sans erreur de type ou de lint ;
- build Next.js réussi avec **98 pages statiques générées** ;
- `git diff --check` réussi et preuves sans données sensibles.

Les preuves sont dans `outputs/support1/`. La procédure d'exploitation et de reproduction se trouve dans `docs/operations/support1/README.md`.

## Limites restantes

La notification certaine est aujourd'hui interne à TutelLiv. La délivrabilité e-mail, l'expéditeur et la gestion d'échec relèvent de la tâche EMAIL. Le délai affiché est un objectif d'exploitation à confirmer avant d'être inclus dans une offre ou un contrat. La supervision et les alertes externes de panne restent dans OPS-03B.
