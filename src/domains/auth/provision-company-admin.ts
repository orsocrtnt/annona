import { createPasswordLinkClient } from "@/services/supabase/password-link";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { getPasswordLinkRedirect } from "@/lib/auth/email-links";

interface ProvisionCompanyAdminInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
}

/** L'entreprise sera provisionnée après vérification du lien, jamais à la soumission du formulaire. */
export async function provisionCompanyAdmin(input: ProvisionCompanyAdminInput) {
  const redirectTo = getPasswordLinkRedirect();
  const client = createPasswordLinkClient();
  const { data, error } = await client.auth.signUp({
    email: normalizeEmail(input.email), password: input.password,
    options: { emailRedirectTo: redirectTo, data: {
      first_name: input.firstName, last_name: input.lastName,
      company_name: input.companyName ?? "", account_type: "company",
    } },
  });
  if (error?.status === 429) throw new Error("AUTH_RATE_LIMITED");
  if (error) throw new Error("AUTH_EMAIL_FAILED");
  if (data.session) {
    await client.auth.signOut({ scope: "global" });
    throw new Error("AUTH_EMAIL_CONFIRMATION_REQUIRED");
  }
  // Supabase peut masquer un compte existant : réponse identique, aucun secret renvoyé.
  return { verificationRequired: true };
}
