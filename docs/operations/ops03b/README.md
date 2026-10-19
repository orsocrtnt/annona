# OPS-03B — Santé du service et procédure d'incident

État de référence : 16 octobre 2026. Cette procédure couvre le socle local de diagnostic. Elle ne remplace pas la configuration d'un moniteur et d'un canal d'astreinte sur une préproduction isolée.

Décision d'exploitation du 18 octobre 2026 : commencer par des alertes e-mail suivies par le propriétaire. Slack n'est pas nécessaire en V1. Le domaine et le destinataire opérationnel seront configurés avec EMAIL ; aucune alerte réelle n'est encore active.

## Points de contrôle

- `GET /api/health` est une sonde publique minimale. Elle confirme seulement que le processus HTTP répond et ne consulte ni la base, ni Storage, ni les files.
- `GET /api/health?deep=1` exige `Authorization: Bearer <OPS_HEALTH_SECRET>`. Elle vérifie PostgreSQL, le bucket privé des preuves et les traitements opérationnels échoués ou bloqués. Elle ne renvoie aucun identifiant, e-mail, message d'erreur fournisseur ou secret.
- Le diagnostic profond renvoie `200` uniquement si tous les contrôles sont sains. Une dépendance indisponible, une tâche définitivement échouée ou une tâche bloquée renvoie `503`.
- Les workers de récurrence et d'opérations renvoient aussi `503` lorsqu'ils ne terminent pas correctement. Ils produisent un événement structuré `tutelliv.operational_incident`.
- Les erreurs de requête non gérées sont captées par l'instrumentation serveur avec le modèle de route, jamais le chemin réel, les en-têtes ou le message brut.

## Configuration

Utiliser trois secrets distincts : `CRON_SECRET`, `OPS_HEALTH_SECRET` et, si le canal le demande, `OPS_ALERT_WEBHOOK_TOKEN`. Le canal générique se configure avec `OPS_ALERT_WEBHOOK_URL`. En production, seule une URL HTTPS est acceptée.

Le corps envoyé contient uniquement : date, sévérité, source, empreinte stable, résumé nettoyé et compteurs explicitement fournis. Les chaînes de connexion, jetons Bearer, clés usuelles et adresses e-mail sont retirés avant le journal et l'envoi. Un échec du canal est journalisé sans son URL ni son jeton et ne masque jamais la panne initiale.

Ne placer aucune de ces valeurs dans le dépôt, une capture, un rapport ou une preuve. Faire tourner les secrets après toute exposition suspectée.

## Réaction à une alerte

1. Noter la date, la source, l'empreinte et l'environnement. Ne pas copier de secret ni de donnée client.
2. Appeler la sonde publique, puis la sonde profonde avec le secret de l'environnement.
3. Si `database` ou `storage` est `down`, vérifier d'abord l'état du fournisseur et les dernières opérations. Suspendre les écritures risquées ; ne pas lancer de migration, seed ou reset.
4. Si `queue.failed` est supérieur à zéro, ouvrir le dispatch, lire les tâches échouées et leur motif nettoyé, corriger la cause puis utiliser la reprise ciblée existante. Ne jamais remettre toute la base à zéro.
5. Si `queue.stale` est supérieur à zéro, vérifier le planificateur et le worker. Une location de travail est considérée bloquée après dix minutes par la sonde ; le worker possède sa propre reprise après cinq minutes.
6. Après correction, exécuter de nouveau la sonde profonde et le scénario touché. Consigner la cause, l'impact, l'action et la preuve de retour à la normale.

Pour les preuves photo, vérifier le bucket privé et une URL signée de fixture. Pour les récurrences, contrôler le drainage sans doublon. Pour le dispatch et les notifications, utiliser les tâches identifiables de l'entreprise de test et nettoyer seulement ces fixtures.

## Validation avant mise en vente

Sur une préproduction distincte, brancher le webhook ou le moniteur retenu, provoquer successivement une panne de dépendance et une tâche terminale fictive, puis confirmer : réception de l'alerte, absence de secret, diagnostic, correction et retour à l'état sain. Mesurer le délai de détection et nommer le responsable du canal.

OPS-03B reste ouverte tant que cet essai réel n'a pas été effectué. OPS-03A couvre séparément la sauvegarde et la restauration ; une sonde saine ne prouve pas qu'une restauration est possible.

La vérification connectée en lecture seule s'exécute avec `npm run test:ops03b`. Elle lance vingt lectures auth simultanées et contrôle le diagnostic profond sans créer ni modifier de donnée métier.
