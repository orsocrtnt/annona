-- OPS-03B : exécuter la sonde depuis Supabase, indépendamment de Vercel.
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
