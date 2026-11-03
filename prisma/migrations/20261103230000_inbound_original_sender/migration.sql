-- MAIL-PONT, étape 2 : client d'origine lu dans un e-mail transféré à la main. Colonne facultative, sans effet sur les lignes existantes.
ALTER TABLE "inbound_order_emails" ADD COLUMN IF NOT EXISTS "original_sender" TEXT;
