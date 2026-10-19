-- Lectures uniquement, à exécuter sur la cible explicitement identifiée.
SELECT current_database() AS database_name,
       current_schema() AS schema_name,
       current_setting('server_version') AS server_version;

SELECT column_name, data_type, datetime_precision, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deliveries'
  AND column_name IN ('driver_id', 'mission_started_at', 'mission_accepted_at');

SELECT relname, relrowsecurity
FROM pg_class
WHERE oid = 'public.deliveries'::regclass;

-- Après application seulement : anciennes lignes sans confirmation fabriquée.
SELECT COUNT(*) AS deliveries,
       COUNT(mission_accepted_at) AS accepted,
       COUNT(*) FILTER (WHERE mission_started_at IS NOT NULL
                         AND mission_accepted_at IS NULL) AS legacy_started_without_ack
FROM public.deliveries;
