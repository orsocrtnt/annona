# OPS-03B — Moniteur et canal de test de préproduction

Date : 23 octobre 2026.

## Réalisé

- Extensions Supabase `http` et `pg_cron` activées sur la seule préproduction `tutelliv-preproduction`.
- Schéma privé `ops_monitor` ajouté avec journal agrégé, état de transition et rétention de quatre-vingt-dix jours.
- Sonde exécutée depuis Supabase afin de rester indépendante de Vercel.
- Secrets prévus dans Supabase Vault ; aucune valeur n'est stockée dans Git ou dans cette preuve.
- Canal webhook temporaire créé avec seulement des événements techniques nettoyés.
- Panne fictive reçue : statut `down`, sévérité critique, empreinte `ops03b-simulated-outage`, codes synthétiques 599.
- Deux répétitions persistées livrées en 101 à 145 ms ; aucune donnée métier modifiée.
- Clé d'idempotence ajoutée et rappels d'une panne persistante limités à une fois toutes les deux heures.
- Responsable initial désigné : propriétaire de TutelLiv. Le canal e-mail définitif reste rattaché au chantier EMAIL.

## Contrôles de sécurité

`PUBLIC`, `anon` et `authenticated` n'ont aucun droit sur le schéma, les tables, les séquences et les fonctions. Le webhook reçu ne contenait ni jeton Bearer, ni chaîne PostgreSQL, ni e-mail, ni donnée client. Le cron n'a pas été activé pendant la répétition incomplète.

L'alias stable `tutelliv-preproduction.vercel.app` a été relié à la branche `preproduction`, mais Vercel Authentication le protège toujours. Un appel anonyme retourne `302` avant d'atteindre `/api/health`.

## Blocage restant

Le contournement public de l'alias a été refusé car il diminuerait la protection de toute la préproduction. L'alternative sûre est un jeton Vercel Automation Bypass dédié au moniteur, stocké dans Supabase Vault. Sa génération a aussi été arrêtée par le contrôle automatique tant que le propriétaire ne l'a pas explicitement autorisée.

Après autorisation, `npm run ops03b:rehearse-preproduction` doit obtenir successivement : baseline saine, alerte de panne reçue, diagnostic profond sain, alerte de reprise reçue, puis installation du job toutes les trente minutes. OPS-03B restera ouverte jusque-là.

## Preuves

- `outputs/ops03b/test-channel.json` : exécution nettoyée du canal de test ;
- journal privé `ops_monitor.runs` : deux répétitions persistées, sans identifiant métier ;
- procédure : `docs/operations/ops03b/README.md`.
