import { createPasswordLinkClient } from "@/services/supabase/password-link";
import { getUserByAuthId } from "@/domains/user/user.service";
import { isAccountActive } from "@/lib/auth/account-access";
import { prisma } from "@/services/prisma/client";
import { getPasswordLinkRedirect } from "@/lib/auth/email-links";
import { confirmManagedSignupEmail } from "@/domains/signup/signup.service";

export async function requestPasswordRecovery(email: string): Promise<void> {
  const redirectTo = getPasswordLinkRedirect();
  const client = createPasswordLinkClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error?.status === 429) throw new Error("AUTH_RATE_LIMITED");
  // Réponse identique pour une adresse connue ou inconnue ; aucune erreur fournisseur exposée.
  if (error) throw new Error("AUTH_EMAIL_FAILED");
}

type PasswordLinkInput =
  | ({ tokenHash: string } & ({ type: "invite" | "recovery"; password: string } | { type: "signup" }))
  | ({ accessToken: string; refreshToken: string } & ({ type: "invite" | "recovery"; password: string } | { type: "signup" }));

export async function finishPasswordLink(input: PasswordLinkInput): Promise<{ signupResumeToken?: string }> {
  getPasswordLinkRedirect();
  const client = createPasswordLinkClient();
  // Le modèle personnalisable utilise token_hash. Le modèle Supabase par défaut
  // consomme d'abord le jeton, puis renvoie une session dans le fragment de l'URL.
  // Les deux variantes sont validées côté serveur avec un client isolé.
  const { data, error } = "tokenHash" in input
    ? await client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type })
    : await client.auth.setSession({ access_token: input.accessToken, refresh_token: input.refreshToken });
  if (error?.status === 429) throw new Error("AUTH_RATE_LIMITED");
  if (error || !data.user || !data.session || !data.user.email_confirmed_at) throw new Error("AUTH_LINK_INVALID");
  // Mot de passe refusé par Supabase : la session du fragment, déjà détenue par le
  // navigateur, reste utilisable pour corriger sans redemander de lien.
  let keepLinkSession = false;
  try {
    const user = await getUserByAuthId(data.user.id);
    if (input.type === "signup") {
      if (data.user.user_metadata?.signup_flow === "managed") {
        if (user || !data.user.email || typeof data.user.user_metadata.signup_draft_id !== "string" ||
            typeof data.user.user_metadata.signup_link_token !== "string") throw new Error("AUTH_LINK_INVALID");
        const managed = await confirmManagedSignupEmail({
          draftId: data.user.user_metadata.signup_draft_id,
          linkToken: data.user.user_metadata.signup_link_token,
          authUserId: data.user.id,
          email: data.user.email,
        });
        const { error: signOutError } = await client.auth.signOut({ scope: "global" });
        if (signOutError) throw new Error("AUTH_PASSWORD_FAILED");
        return { signupResumeToken: managed.resumeToken };
      }
      // Hors parcours géré, un lien de confirmation ne provisionne rien : les
      // métadonnées (account_type, company_name) sont contrôlées par l'utilisateur.
      throw new Error("AUTH_LINK_INVALID");
    }
    const pending = user?.status === "PENDING_VERIFICATION";
    if (!user || !isAccountActive(pending ? { ...user, status: "ACTIVE" } : user) ||
      (input.type === "invite" && !pending)) throw new Error("AUTH_LINK_INVALID");

    const { error: updateError } = await client.auth.updateUser({ password: input.password });
    if (updateError) {
      const code = (updateError as { code?: string }).code;
      const rejected = code === "weak_password" ? "AUTH_PASSWORD_WEAK" : code === "same_password" ? "AUTH_PASSWORD_SAME" : null;
      if (!rejected) throw new Error("AUTH_PASSWORD_FAILED");
      keepLinkSession = !("tokenHash" in input);
      throw new Error(rejected);
    }
    // Aucune session issue du lien n'est transmise au navigateur.
    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) throw new Error("AUTH_PASSWORD_FAILED");
    if (pending) {
      const activated = await prisma.user.updateMany({
        where: { id: user.id, authId: data.user.id, status: "PENDING_VERIFICATION",
          companyId: user.companyId, company: { status: { in: ["ACTIVE", "TRIAL"] } } },
        data: { status: "ACTIVE" },
      });
      if (activated.count !== 1) throw new Error("AUTH_LINK_INVALID");
    }
    return {};
  } finally {
    // Nettoyage même si la lecture ou l'activation échoue. Aucun token dans les logs.
    if (!keepLinkSession) await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
