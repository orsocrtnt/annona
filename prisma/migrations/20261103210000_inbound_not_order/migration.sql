-- MAIL-PONT, étape 1 : e-mail ordinaire rangé dans « À trier ». Ajout seul, sans effet sur les lignes existantes.
ALTER TYPE "InboundEmailStatus" ADD VALUE IF NOT EXISTS 'NOT_ORDER';
