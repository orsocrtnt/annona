# OPS-03B — Socle local de diagnostic

Date : 16 octobre 2026. Avancement local, sans déploiement ni canal externe.

## Résultat

TutelLiv dispose désormais d'une sonde publique minimale et d'un diagnostic profond protégé qui contrôle la base, le stockage privé des preuves et les files opérationnelles. Le diagnostic ne publie aucun détail métier. Les workers de récurrence et d'opérations signalent leurs échecs avec un format stable, nettoient les valeurs sensibles et peuvent envoyer l'événement à un webhook HTTPS dédié. L'instrumentation serveur capte aussi les erreurs de requête non gérées avec le modèle de route, sans chemin réel, en-têtes ou message brut.

Le cron des opérations renvoie maintenant `503` lorsqu'une tâche a épuisé ses tentatives, au lieu de répondre avec un succès trompeur. Le cron de récurrence conserve son `503` en cas d'échec ou de file non vidée et émet le signal correspondant.

## Validation locale

- panne terminale du worker : réponse `503` et un incident produit ;
- sonde publique : aucune lecture profonde ni détail de configuration ;
- sonde profonde : autorisation obligatoire, base, stockage et file contrôlés ;
- événement : jeton Bearer, chaîne PostgreSQL, clé ressemblant à une clé d'API, e-mail et URL privée absents du journal et du corps ;
- échec du canal : panne d'envoi contenue sans masquer l'incident initial.

Les tests ciblés initiaux ont réussi sur 19 scénarios couvrant aussi les récurrences et les preuves photo. Après ajout de l'instrumentation, la suite complète réussit avec 235/235 tests, types et lint stricts, 34 documents valides, diff-check propre et build Next.js de 100 pages.

Pendant la recette locale, les appels parallèles de l'interface ont révélé une panique Prisma 5.22 dans la stratégie expérimentale `relationJoins` de la lecture auth. Le défaut a été reproduit avec vingt lectures simultanées, puis la stratégie expérimentale a été retirée sans ajouter de cache d'autorisation. La sonde de dépendances restait saine pendant cette panne applicative : ce constat confirme qu'un suivi des erreurs de requête doit compléter la sonde avant de clôturer OPS-03B.

La recette connectée `npm run test:ops03b` relit vingt fois le même contexte auth en parallèle, contrôle base, bucket et file, puis écrit une preuve sans identifiant. Résultat : 20/20 lectures, santé `ok`, zéro mutation. Preuve : `outputs/ops03b/connected.json`.

## Limite restante

Aucun service de supervision, webhook, canal d'astreinte ou préproduction n'a été créé. Le responsable opérationnel et le délai d'intervention restent à définir. OPS-03B demeure donc ouverte jusqu'à une panne simulée sur l'environnement isolé d'ENV-1, avec alerte effectivement reçue puis résolue.
