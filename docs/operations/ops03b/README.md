# OPS-03B — Santé du service et procédure d'incident

État de référence : 23 octobre 2026. Le diagnostic applicatif et le moniteur indépendant sont actifs sur la préproduction isolée. Un jeton d'automatisation dédié traverse la protection Vercel sans rendre le site public.

Décision d'exploitation du 18 octobre 2026 : commencer par des alertes e-mail suivies par le propriétaire. Slack n'est pas nécessaire en V1. Le canal webhook de recette est actif ; le domaine et le destinataire opérationnel seront configurés avec EMAIL avant les pilotes réels.

## Moniteur de préproduction

- Supabase exécute la sonde, donc une indisponibilité de Vercel reste détectable.
- Le rythme prévu est de trente minutes, sans coût additionnel sur les offres gratuites actuelles.
- Les secrets `ops03b_app_url`, `ops03b_health_secret`, `ops03b_vercel_bypass` et `ops03b_webhook_url` vivent dans Supabase Vault. Ils n'entrent ni dans Git, ni dans les preuves, ni dans le journal.
- `ops_monitor.run(false)` contrôle la sonde publique puis le diagnostic profond. `ops_monitor.run(true)` est réservé à la répétition opérateur d'une panne fictive.
- Les résultats agrégés sont conservés quatre-vingt-dix jours dans le schéma privé `ops_monitor`. Aucun identifiant client, e-mail, URL ou message fournisseur n'y est écrit.
- Une alerte est envoyée au passage sain → panne, puis au retour panne → sain. Une panne persistante peut produire un rappel au plus tôt deux heures plus tard. Chaque signal porte une clé d'idempotence.
- Le propriétaire de Annona est le responsable initial du canal. Le webhook temporaire sert seulement à la recette ; EMAIL le remplacera par le destinataire opérationnel confirmé.
- Canal e-mail (OPS-FIAB, 4 novembre 2026, migration `20261104040000_ops_monitor_email_alerts`) : la base envoie elle-même l'e-mail par l'API Resend, sans passer par Vercel. Il est actif dès que trois secrets existent dans Vault : `ops03b_resend_api_key`, `ops03b_alert_email_from`, `ops03b_alert_email_to`. Il passe alors avant le webhook, qui ne sert plus. Copie depuis `.env.local` (clé Resend, `MAIL_FROM`, destinataire `OPS_ALERT_RECIPIENT`, sinon `EMAIL_TEST_RECIPIENT`) : `sh scripts/ops03b/copy-alert-email.sh`, qui n'affiche aucune valeur et refuse toute autre base que la préproduction. Essai : `select ops_monitor.run(true);` envoie un e-mail « [Essai] » ; le passage suivant de la sonde (sain) envoie l'e-mail de retour à la normale.

La configuration et la répétition s'exécutent avec `npm run ops03b:rehearse-preproduction`. Le fichier `.env.ops03b.local`, ignoré par Git, doit contenir l'URL de la préproduction, le webhook de recette et le jeton Vercel limité à l'automatisation. Le script refuse une cible Supabase différente de la préproduction déclarée.

## Points de contrôle

- `GET /api/health` est une sonde publique minimale. Elle confirme seulement que le processus HTTP répond et ne consulte ni la base, ni Storage, ni les files.
- `GET /api/health?deep=1` exige `Authorization: Bearer <OPS_HEALTH_SECRET>`. Elle vérifie PostgreSQL, le bucket privé des preuves et les traitements opérationnels échoués ou bloqués. Elle ne renvoie aucun identifiant, e-mail, message d'erreur fournisseur ou secret.
- Le diagnostic profond renvoie `200` uniquement si tous les contrôles sont sains. Une dépendance indisponible, une tâche définitivement échouée ou une tâche bloquée renvoie `503`.
- Les workers de récurrence et d'opérations renvoient aussi `503` lorsqu'ils ne terminent pas correctement. Ils produisent un événement structuré `annona.operational_incident`.
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

## Répétition du 23 octobre 2026

La migration additive a été appliquée à `annona-preproduction`. Le schéma et ses fonctions sont inaccessibles à `PUBLIC`, `anon` et `authenticated`. Deux répétitions persistées ont produit un événement critique reçu par le canal de test en 101 à 145 ms ; le corps ne contenait ni secret, ni e-mail, ni donnée métier. La version finale ajoute une clé d'idempotence et limite les rappels.

La répétition complète a ensuite confirmé une baseline réelle saine, une panne fictive alertée en 80 ms et une reprise réelle alertée en 1 369 ms. Les deux appels réels ont reçu HTTP 200 sur les sondes publique et profonde ; base, Storage et file étaient `ok`. L'état final est sain et un seul job `ops03b-preproduction-health` est actif toutes les trente minutes. Le jeton Vercel **Automation Bypass** dédié reste dans Vault et peut être révoqué.

## Validation avant mise en vente

Sur une préproduction distincte, brancher le webhook ou le moniteur retenu, provoquer successivement une panne de dépendance et une tâche terminale fictive, puis confirmer : réception de l'alerte, absence de secret, diagnostic, correction et retour à l'état sain. Mesurer le délai de détection et nommer le responsable du canal.

OPS-03B est terminée. OPS-03A couvre séparément la sauvegarde et la restauration ; une sonde saine ne prouve pas qu'une restauration est possible.

## Arrêt et retour arrière

Pour arrêter sans supprimer les preuves, désactiver le job nommé `ops03b-preproduction-health` dans Supabase Cron. Pour retirer complètement le moniteur de recette, révoquer ensuite le jeton Automation Bypass dans Vercel, puis les quatre secrets `ops03b_*` dans Vault. Ne supprimer le schéma `ops_monitor` qu'après export du journal utile. Aucune de ces opérations ne touche les tables métier.

La vérification connectée en lecture seule s'exécute avec `npm run test:ops03b`. Elle lance vingt lectures auth simultanées et contrôle le diagnostic profond sans créer ni modifier de donnée métier.

## SCHEMA-1 (6 novembre 2026) : scripts hors migrations Prisma

La migration initiale unique du nouveau produit (`prisma/migrations/20261106200000_init`) ne contient que le schéma applicatif. Le moniteur, qui dépend des extensions `http` et `pg_cron` et de Supabase Vault, est conservé à part dans ce dossier, dans l'ordre d'application : `20261023190000_ops03b_monitor_extensions.sql`, `20261023191000_ops03b_monitor.sql`, `20261023192000_ops03b_monitor_fix.sql`, `20261104040000_ops_monitor_email_alerts.sql`. À appliquer manuellement (`prisma db execute --file`) sur l'environnement qui doit être surveillé, après décision du propriétaire ; aucun n'a été appliqué à `annona-dev`.

