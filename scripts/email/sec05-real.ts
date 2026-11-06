// SEC-05 — recette réelle sur `annona-dev` (ENV-2) avec le vrai Supabase Auth, sans envoi d'e-mail :
// les liens sont produits par `admin.generateLink` (même jeton que l'e-mail) puis consommés par le service
// de l'application. Vérifie : invitation acceptée une fois puis refusée au rejeu, récupération idem,
// connexion avec le nouveau mot de passe, déconnexion qui révoque le jeton de rafraîchissement.
// Compte E2E identifiable `e2e-sec05-…@annona.test`, supprimé à la fin.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { prisma } from "@/services/prisma/client";
import { finishPasswordLink } from "@/domains/auth/password-link.service";
import { validateDevEnvironment } from "../env2/verify-dev-env";

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const email = `e2e-sec05-${stamp}@annona.test`;
const password = () => `E2e${randomBytes(9).toString("base64url")}9a`;

const outcome = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return "accepté";
  } catch (error) {
    return error instanceof Error ? error.message : "ERREUR";
  }
};

async function main() {
  const errors = validateDevEnvironment(process.env);
  if (errors.length) throw new Error(`DEV_ENVIRONMENT_REQUIRED:${errors.join(",")}`);
  // Liens Auth activés pour ce seul processus : aucun e-mail n'est envoyé par `generateLink`.
  process.env.AUTH_EMAIL_LINKS_ENABLED = "true";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const options = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as never } };
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, options);
  const anon = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);

  const company = await prisma.company.findFirst({ where: { status: { in: ["ACTIVE", "TRIAL"] } }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const role = await prisma.role.findFirst({ where: { systemRole: "MERCHANT" }, select: { id: true } });
  if (!company || !role) throw new Error("FIXTURE_MISSING");

  const report: Record<string, unknown> = { email };
  let authId: string | null = null;
  try {
    // 1. Invitation : lien consommé une fois, refusé au rejeu.
    const invite = await admin.auth.admin.generateLink({ type: "invite", email });
    if (invite.error || !invite.data.user) throw new Error(`INVITE_LINK_FAILED:${invite.error?.status}`);
    authId = invite.data.user.id;
    await prisma.user.create({
      data: { authId, email, firstName: "E2E", lastName: "SEC05", roleId: role.id, companyId: company.id, status: "PENDING_VERIFICATION" },
    });
    const inviteHash = invite.data.properties.hashed_token;
    const first = password();
    report.invitation = {
      premierUsage: await outcome(() => finishPasswordLink({ tokenHash: inviteHash, type: "invite", password: first, confirmPassword: first } as never)),
      rejeu: await outcome(() => finishPasswordLink({ tokenHash: inviteHash, type: "invite", password: first, confirmPassword: first } as never)),
      statutCompte: (await prisma.user.findUnique({ where: { email }, select: { status: true } }))?.status,
    };

    // 2. Récupération : nouveau mot de passe, rejeu refusé.
    const recovery = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (recovery.error) throw new Error(`RECOVERY_LINK_FAILED:${recovery.error.status}`);
    const recoveryHash = recovery.data.properties.hashed_token;
    const second = password();
    report.recuperation = {
      premierUsage: await outcome(() => finishPasswordLink({ tokenHash: recoveryHash, type: "recovery", password: second, confirmPassword: second } as never)),
      rejeu: await outcome(() => finishPasswordLink({ tokenHash: recoveryHash, type: "recovery", password: second, confirmPassword: second } as never)),
    };

    // 3. Connexion : ancien mot de passe refusé, nouveau accepté ; déconnexion qui révoque la session.
    const oldLogin = await anon().auth.signInWithPassword({ email, password: first });
    const browser = anon();
    const login = await browser.auth.signInWithPassword({ email, password: second });
    const refreshToken = login.data.session?.refresh_token;
    const signOut = await browser.auth.signOut(); // Même appel que `use-auth.ts` (portée globale par défaut).
    const reuse = refreshToken ? await anon().auth.refreshSession({ refresh_token: refreshToken }) : null;
    report.connexion = {
      ancienMotDePasse: oldLogin.error ? "refusé" : "accepté",
      nouveauMotDePasse: login.error ? `refusé:${login.error.status}` : "accepté",
      deconnexion: signOut.error ? `erreur:${signOut.error.status}` : "ok",
      jetonApresDeconnexion: reuse ? (reuse.error ? "refusé" : "accepté") : "absent",
    };
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    if (authId) await admin.auth.admin.deleteUser(authId);
    report.nettoyage = { compteSupprime: Boolean(authId) };
    await prisma.$disconnect();
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "SEC05_REAL_FAILED");
  process.exitCode = 1;
});
