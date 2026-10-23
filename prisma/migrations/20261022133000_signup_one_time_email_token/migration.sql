-- La confirmation e-mail utilise un secret dédié et à usage unique.
-- Le jeton de reprise principal n'est jamais copié dans Supabase Auth.
ALTER TABLE "signup_journeys"
  ADD COLUMN "email_link_token_hash" TEXT;
