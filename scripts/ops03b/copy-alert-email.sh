#!/bin/sh
# Copie la clé Resend, l'expéditeur et le destinataire des alertes vers le coffre Supabase de la
# préproduction, pour l'e-mail de la sonde externe (ops_monitor). N'affiche aucune valeur.
# Le script Node refuse toute autre base que la préproduction. Voir docs/operations/ops03b/README.md.
set -eu
node scripts/ops03b/store-alert-email.mjs
