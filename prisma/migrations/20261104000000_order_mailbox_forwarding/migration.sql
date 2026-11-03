-- MAIL-PONT, étape 3 : boîte de commandes de l'entreprise et code de confirmation de renvoi Gmail. Ajouts seuls.
ALTER TYPE "InboundEmailStatus" ADD VALUE IF NOT EXISTS 'FORWARDING_CONFIRMATION';
ALTER TABLE "company_intake_channels" ADD COLUMN IF NOT EXISTS "order_mailbox_address" TEXT;
