-- ACK-1 : préparation uniquement. Ne pas exécuter sans validation DB-1/cible.
-- Tester sur copie isolée et confirmer le schéma public avant application.
-- Aucun backfill : une date historique inconnue reste inconnue.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.deliveries
  ADD COLUMN mission_accepted_at TIMESTAMP(3);
COMMIT;
