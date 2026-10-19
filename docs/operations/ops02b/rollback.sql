-- RETOUR ARRIÈRE MANUEL UNIQUEMENT.
-- Supprime la file OPS-02B et les clés d'idempotence ; ne pas exécuter si des travaux sont à conserver.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS public."operation_jobs";
DROP TYPE IF EXISTS public."OperationJobStatus";
DROP TYPE IF EXISTS public."OperationJobType";
ALTER TABLE public."orders"
  DROP COLUMN IF EXISTS "request_fingerprint",
  DROP COLUMN IF EXISTS "idempotency_key";

COMMIT;
