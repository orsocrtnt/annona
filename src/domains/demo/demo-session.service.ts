/**
 * DEMO-1 — ouverture d'un espace de démo sans identifiants : le serveur génère un lien de connexion à usage unique
 * pour le compte de l'espace choisi (aucun e-mail n'est envoyé) et le valide aussitôt ; la session Supabase est
 * posée en cookie. Seul le porteur du prêt de l'environnement peut le faire.
 */
import "server-only";
import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import { createClient } from "@/services/supabase/server";
import { demoPersonaUserId, type DemoPersona } from "@/domains/demo/demo-scenario";
import { findDemoLease } from "@/domains/demo/demo-pool.service";

export class DemoLeaseMissingError extends Error {
  constructor() {
    super("Votre démo a expiré. Relancez-en une.");
  }
}

/** Adresse d'arrivée : l'accueil de chaque espace (le middleware y renvoie selon le rôle). */
export const DEMO_PERSONA_HOME: Record<DemoPersona, string> = {
  client: "/portal",
  admin: "/dashboard",
  baker: "/bakery",
  driver: "/driver",
};

export async function openDemoPersonaSession(leaseToken: string | undefined, persona: DemoPersona) {
  const env = await findDemoLease(leaseToken);
  if (!env) throw new DemoLeaseMissingError();
  const user = await prisma.user.findUnique({
    where: { id: demoPersonaUserId(env.slot, persona) },
    select: { email: true, companyId: true },
  });
  if (!user || user.companyId !== env.companyId) throw new DemoLeaseMissingError();

  const link = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: user.email });
  const tokenHash = link.data.properties?.hashed_token;
  if (!tokenHash) throw new Error(`Lien de démo non généré : ${link.error?.message ?? "inconnu"}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) throw new Error(`Connexion de démo refusée : ${error.message}`);
  return { redirectTo: DEMO_PERSONA_HOME[persona], expiresAt: env.leaseExpiresAt };
}
