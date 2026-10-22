-- DEMO-2: la table de coordination reste exclusivement serveur.
ALTER TABLE "demo_pool_environments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE "demo_pool_environments" FROM authenticated;
