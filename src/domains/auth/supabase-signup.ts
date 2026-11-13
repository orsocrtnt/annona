import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { createAdminClient } from "@/services/supabase/admin";
import type { SessionIdentity, SignupAuthProvider } from "@/domains/auth/company-signup.service";

/**
 * Compte de connexion d'une inscription par e-mail (AUTH-GOOGLE). Le client passé est celui de la requête
 * (cookies) : il garde la clé PKCE du lien de confirmation dans le navigateur qui s'inscrit.
 * Supabase répond sans erreur pour une adresse déjà inscrite quand la confirmation est active
 * (identités vides) : on le traite comme « déjà inscrite », sans rien créer.
 */
export function supabaseSignupProvider(client: SupabaseClient, confirmRedirect: string): SignupAuthProvider {
  return {
    async signUp(email, password, metadata) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: confirmRedirect, data: metadata },
      });
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        if (message.includes("already") || message.includes("registered")) return { kind: "already-registered" };
        if (error.status === 429) {
          throw new DomainRuleError(429, "Trop d'inscriptions en peu de temps. Réessayez dans une heure ou continuez avec Google.", "AUTH_RATE_LIMITED");
        }
        if (message.includes("password")) {
          throw new DomainRuleError(400, "Mot de passe refusé : choisissez-en un plus long ou moins courant.", "WEAK_PASSWORD");
        }
        throw new DomainRuleError(502, "L'e-mail de confirmation n'a pas pu être envoyé. Réessayez plus tard ou continuez avec Google.", "SIGNUP_EMAIL_FAILED");
      }
      if (!data.user || (data.user.identities?.length ?? 0) === 0) return { kind: "already-registered" };
      return { kind: "created", authId: data.user.id };
    },
    async remove(authId) {
      await createAdminClient().auth.admin.deleteUser(authId);
    },
  };
}

/** Identité de la session Supabase, telle que le serveur la relit (fournisseurs dans app_metadata). */
export function sessionIdentity(user: User): SessionIdentity {
  const fromMetadata = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as unknown[]) : [];
  const fromIdentities = (user.identities ?? []).map((identity) => identity.provider);
  const providers = [...new Set([...fromMetadata, ...fromIdentities].filter((value): value is string => typeof value === "string"))];
  return {
    authId: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    providers,
  };
}

/** Prénom et nom proposés par Google, seulement pour pré-remplir le formulaire (modifiables). */
export function googleNameHints(user: User): { firstName: string; lastName: string } {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 80) : "");
  const given = text(meta.given_name);
  const family = text(meta.family_name);
  if (given || family) return { firstName: given, lastName: family };
  const full = text(meta.full_name) || text(meta.name);
  const [first = "", ...rest] = full.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}
