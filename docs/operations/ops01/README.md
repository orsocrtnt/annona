# OPS-01 — Commandes récurrentes fiables

Les récurrences représentent des **dates calendaires UTC**. Le navigateur envoie une date `AAAA-MM-JJ`, le serveur la stocke à minuit UTC et l'interface l'affiche dans ce même calendrier. L'heure locale du navigateur ou du serveur ne déplace donc pas l'échéance d'un jour. Le cron actuel reste planifié chaque jour à 06:00 UTC ; OPS-01 ne modifie ni l'hébergement ni cette fréquence.

Pour les intervalles mensuels, le jour de la date de début sert d'ancre. Une série commencée le 31 produit le dernier jour d'un mois plus court, puis revient au 31 dès que le mois le permet. Les intervalles en jours et semaines sont aussi calculés en UTC.

## Unicité et reprise

Une commande et sa livraison, créées dans la transaction existante, forment l'occurrence durable. Sa clé est `recurring:<identifiant-récurrence>:<date-ISO>` et l'unicité déjà portée par la commande empêche une seconde création pour le même client.

Le worker crée ou retrouve cette occurrence avant d'avancer `nextRunAt`. Une interruption après la création laisse donc l'échéance visible ; l'appel suivant retrouve la même commande, puis avance la récurrence. Un échec est compté, la récurrence concernée n'est pas bouclée dans le même appel et l'API cron répond `503` tant qu'une reprise est nécessaire.

Le worker lit des lots de 25 et continue jusqu'à drainage, avec une borne de 500 occurrences par appel. `hasMore: true` rend un reliquat explicite. Les récurrences en pause ou annulées sont exclues. Une échéance postérieure à la date de fin clôt la série sans créer de commande ; la dernière occurrence autorisée est créée avant la clôture.

## Vérification locale

- `npm run check` vérifie le calcul calendaire, 100 échéances, le rejeu après panne, les statuts et la route cron.
- `npm run test:ops01` utilise uniquement une entreprise fictive préfixée `ops01-`. Il vérifie un lot connecté, précrée une occurrence pour reproduire une interruption avant l'avancement, contrôle le rejeu sans doublon, puis supprime commandes, livraisons, tâches, récurrences, utilisateurs et entreprise.
- `npm run build` valide l'intégration Next.js.

La cible connectée peut connaître une erreur d'infrastructure PostgreSQL. Elle doit alors être relancée : le premier essai du 16 octobre 2026 a rencontré `P1017`, puis le rejeu a réussi avec zéro résidu. Cette reprise ne remplace pas DB-1, la préproduction ni la surveillance du cron déployé.
