#!/bin/sh
# Copie CRON_SECRET vers le coffre Supabase de la préproduction, sans rien afficher.
# Vercel ne rend pas les variables « sensibles » (`vercel env pull` écrit "[SENSITIVE]") : la source est
# donc le fichier local .env.preproduction.local du propriétaire. Le script Node refuse toute autre base.
# Voir docs/OPERATIONS.md, « Relais des tâches de fond ».
set -eu
if [ ! -f .env.preproduction.local ]; then
  echo '{"stored":false,"raison":".env.preproduction.local absent"}'
  exit 1
fi
npx dotenv -e .env.preproduction.local -- node scripts/ops03b/store-relay-secret.mjs
