#!/bin/sh
# Copie CRON_SECRET de Vercel (préproduction) vers le coffre Supabase de la préproduction, sans rien afficher.
# Fichier temporaire supprimé en toute circonstance. Voir docs/OPERATIONS.md, « Relais des tâches de fond ».
set -eu
F=$(mktemp)
trap 'rm -f "$F"' EXIT INT TERM
vercel env pull "$F" --environment=preview --git-branch=preproduction --yes >/dev/null
npx dotenv -e "$F" -- node scripts/ops03b/store-relay-secret.mjs
