# DISPATCH-1 — Affectations concurrentes et cycle de mission

Date de validation : 2026-10-09

## Résultat

DISPATCH-1 est terminée. Une affectation réclame désormais atomiquement l’état observé de la livraison. Les affectations concurrentes ne peuvent plus toutes deux réussir ni produire deux historiques. La capacité est recalculée dans la transaction sous verrou du chauffeur, ce qui protège aussi deux livraisons concurrentes visant sa dernière place.

Les règles sont séparées : seul un plafond de charge peut être dépassé avec `force`, et cette décision est inscrite dans l’historique. Une pause dispatch, une catégorie ou zone incompatible, une mission démarrée et un état terminal restent non forçables. Réaffectation et retrait ne sont possibles que sur une mission `ASSIGNED` non démarrée. Un rejeu vers le chauffeur déjà affecté est idempotent.

Après démarrage, réaffectation et retrait sont refusés. Une annulation dédiée reste possible avec un motif obligatoire ; l’horodatage de départ est conservé et l’événement contient le chauffeur précédent et le motif. Les transitions chauffeur et le démarrage utilisent aussi une comparaison atomique, de sorte qu’un double clic ne produit pas deux événements. La suppression d’un chauffeur ayant une mission active est refusée ; la suppression d’une commande est limitée aux demandes de devis sans livraison ni facture.

## Vérifications

- `npm run check` : TypeScript valide, lint sans erreur avec 24 avertissements historiques, 81 tests réussis sur 81.
- Six tests de règles couvrent états affectables, incohérences statut/chauffeur, retrait, annulation motivée et séparation des règles de capacité des règles dures.
- Recette connectée : 14 scénarios réussis sur deux sessions administrateur indépendantes, plus une session d’une autre entreprise.
- Même livraison, deux chauffeurs : 200/409, un responsable final commun aux deux lectures, un événement et une tâche.
- Dernière place de capacité : 200/409 et une seule affectation ; dépassement volontaire ensuite réussi et tracé.
- Chauffeur en pause : deux refus 409, y compris avec `force`, sans événement ni mutation.
- Auto-dispatch contre affectation manuelle : un seul gagnant et un seul événement.
- Double démarrage : un succès, un conflit et un seul événement.
- Après démarrage : réaffectation, retrait et annulation sans motif refusés sans mutation ; annulation motivée ensuite réussie avec trace complète.
- Suppression du chauffeur actif, annulation générique d’une mission démarrée et suppression d’une commande opérationnelle refusées en 409.
- Frontière entreprise : ressource étrangère masquée en 404.
- Nettoyage : zéro commande, chauffeur ou tâche fictive résiduelle.
- `npm run build` et `git diff --check` : réussis.

## Choix métier appliqués

- Première affectation : `PENDING`, sans chauffeur et sans démarrage.
- Réaffectation ou retrait : seulement `ASSIGNED` avant démarrage.
- Après démarrage : pas de transfert implicite ; annulation seulement par l’action dédiée avec motif.
- États terminaux : non affectables et non supprimables depuis le dispatch.
- Facture payée : annulation refusée ; les factures non payées suivent une annulation de commande avant départ.
- Historique opérationnel : les commandes qui en possèdent ne sont plus supprimables.

## Limites conservées

ACK-1 reste ouvert : TutelLiv doit encore décider si « prise en charge » et « début réel » sont un seul geste ou deux états, puis montrer le même horodatage dans les trois espaces. R04 n’est donc que partiellement avancé. La recette a utilisé le client HTTP Node 22 contre le site local et la base de test autorisée ; elle ne constitue ni un test visuel navigateur, ni un test de charge, ni un essai terrain. Aucun changement de schéma, migration ou déploiement n’a été effectué.

## Preuves

- `tests/dispatch-policy.test.ts`
- `outputs/dispatch1/check.log`
- `outputs/dispatch1/build.log`
- `outputs/dispatch1/connected.json`
- `outputs/dispatch1/final-verification.json`
