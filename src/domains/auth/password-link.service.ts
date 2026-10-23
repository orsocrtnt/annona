import { createPasswordLinkClient } from "@/services/supabase/password-link";
import { syncUserFromSupabase } from "@/domains/auth/auth.service";
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

export async function finishPasswordLink(input: { tokenHash: string; type: "invite" | "recovery"; password: string } | { tokenHash: string; type: "signup" }): Promise<{ signupResumeToken?: string }> {
  getPasswordLinkRedirect();
  const client = createPasswordLinkClient();
  // Supabase vérifie et consomme le jeton à usage unique, avec expiration et limites serveur.
  const { data, error } = await client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type });
  if (error?.status === 429) throw new Error("AUTH_RATE_LIMITED");
  if (error || !data.user || !data.session || !data.user.email_confirmed_at) throw new Error("AUTH_LINK_INVALID");
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
      if (user || !data.user.email || data.user.user_metadata?.account_type !== "company") throw new Error("AUTH_LINK_INVALID");
      const { error: signOutError } = await client.auth.signOut({ scope: "global" });
      if (signOutError) throw new Error("AUTH_PASSWORD_FAILED");
      await syncUserFromSupabase({
        authId: data.user.id, email: data.user.email,
        firstName: data.user.user_metadata.first_name ?? "Utilisateur",
        lastName: data.user.user_metadata.last_name ?? "",
        accountType: "company", companyName: data.user.user_metadata.company_name,
      });
      return {};
    }
    const pending = user?.status === "PENDING_VERIFICATION";
    if (!user || !isAccountActive(pending ? { ...user, status: "ACTIVE" } : user) ||
      (input.type === "invite" && !pending)) throw new Error("AUTH_LINK_INVALID");

    const { error: updateError } = await client.auth.updateUser({ password: input.password });
    if (updateError) throw new Error("AUTH_PASSWORD_FAILED");
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
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
