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
- Jeton Vercel Automation Bypass dédié créé après autorisation explicite, conservé uniquement dans Vault ; la préproduction reste protégée.
- Baseline réelle saine : sondes publique et profonde HTTP 200, base, Storage et file `ok`.
- Répétition finale : panne fictive alertée en 80 ms, puis reprise réelle alertée en 1 369 ms.
- Un seul job `ops03b-preproduction-health` actif toutes les trente minutes ; état final `healthy`.

## Contrôles de sécurité

`PUBLIC`, `anon` et `authenticated` n'ont aucun droit sur le schéma, les tables, les séquences et les fonctions. Le webhook reçu ne contenait ni jeton Bearer, ni chaîne PostgreSQL, ni e-mail, ni donnée client. Le cron n'a pas été activé pendant la répétition incomplète.

L'alias stable `tutelliv-preproduction.vercel.app` a été relié à la branche `preproduction`, mais Vercel Authentication le protège toujours. Un appel anonyme retourne `302` avant d'atteindre `/api/health`.

## Fermeture

Le contournement public de l'alias a été refusé car il aurait diminué la protection de toute la préproduction. L'alternative sûre a été mise en place après autorisation : jeton dédié, révocable, non exposé et stocké dans Supabase Vault.

Les critères OPS-03B sont atteints : diagnostic réel sain, alerte de panne, alerte de reprise, responsable et procédure documentés, surveillance périodique active. L'activation d'un canal e-mail réel reste dans EMAIL et ne remet pas en cause la recette du canal de test.

## Preuves

- `outputs/ops03b/test-channel.json` : exécution nettoyée du canal de test ;
- journal privé `ops_monitor.runs` : deux répétitions persistées, sans identifiant métier ;
- procédure : `docs/operations/ops03b/README.md`.
