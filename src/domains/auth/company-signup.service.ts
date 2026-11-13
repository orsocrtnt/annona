/**
 * AUTH-GOOGLE (décision d'Orso du 13 novembre 2026, écart accepté avec PLA-02) : une boulangerie crée
 * elle-même son entreprise et son compte administrateur, par e-mail ou avec Google. L'entreprise naît
 * au statut « Essai » (TRIAL, même accès qu'active). Les comptes des clients et des employés restent
 * créés par l'administrateur (ADM-01) : aucune autre inscription libre.
 */
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import {
  insertCompanyWithAdmin,
  prepareCompanyCreation,
  type CompanyAdminDb,
} from "@/domains/admin/company-admin.service";

/** Réponse unique de l'inscription par e-mail, que l'adresse soit libre ou non. */
export const SIGNUP_SENT_MESSAGE =
  "Vérifiez votre boîte mail : cliquez sur le lien de confirmation pour ouvrir votre espace. Si cette adresse a déjà un compte, connectez-vous.";

/** Réglages de départ d'une entreprise inscrite ; modifiables ensuite dans Paramètres. */
export const SIGNUP_COMPANY_DEFAULTS = {
  cutoffTime: "17:00",
  timezone: "Europe/Paris",
  reminderLeadMinutes: 120,
} as const;

export interface CompanySignupInput {
  companyName: string;
  firstName: string;
  lastName: string;
}

export interface EmailSignupInput extends CompanySignupInput {
  email: string;
  password: string;
}

/** Compte de connexion Supabase créé par e-mail (lien de confirmation envoyé par Supabase). */
export type SignUpResult = { kind: "created"; authId: string } | { kind: "already-registered" };

export interface SignupAuthProvider {
  signUp(email: string, password: string, metadata: { first_name: string; last_name: string }): Promise<SignUpResult>;
  remove(authId: string): Promise<void>;
}

/** Identité relue côté serveur dans la session Supabase (jamais envoyée par le navigateur). */
export interface SessionIdentity {
  authId: string;
  email: string;
  emailConfirmed: boolean;
  providers: string[];
}

/**
 * Inscription par e-mail. Réponse identique que l'adresse soit libre ou non (pas de découverte des
 * comptes) : `sent` seulement. L'administrateur reste « en attente » jusqu'au lien de confirmation.
 */
export async function signUpCompanyWithEmail(
  input: EmailSignupInput,
  deps: { db: CompanyAdminDb; auth: SignupAuthProvider }
): Promise<{ kind: "sent" }> {
  const email = normalizeEmail(input.email);
  let prepared: { roleId: string; slug: string };
  try {
    prepared = await prepareCompanyCreation(deps.db, input.companyName, email);
  } catch (error) {
    if (error instanceof DomainRuleError && error.code === "EMAIL_EXISTS") return { kind: "sent" };
    throw error;
  }

  const account = await deps.auth.signUp(email, input.password, { first_name: input.firstName, last_name: input.lastName });
  if (account.kind === "already-registered") return { kind: "sent" };

  try {
    await insertCompanyWithAdmin(deps.db, {
      name: input.companyName,
      slug: prepared.slug,
      roleId: prepared.roleId,
      companyStatus: "TRIAL",
      ...SIGNUP_COMPANY_DEFAULTS,
      admin: { firstName: input.firstName, lastName: input.lastName, email },
      authId: account.authId,
      userStatus: "PENDING_VERIFICATION",
    });
  } catch (error) {
    // Aucune entreprise à moitié créée : le compte de connexion est retiré.
    await deps.auth.remove(account.authId).catch(() => undefined);
    throw error;
  }
  return { kind: "sent" };
}

export function hasGoogleIdentity(identity: SessionIdentity): boolean {
  return identity.providers.includes("google");
}

/**
 * Fin d'inscription après « Continuer avec Google » : l'adresse est celle prouvée par Google, relue dans la
 * session. L'administrateur est actif tout de suite (pas de lien de confirmation à attendre).
 */
export async function signUpCompanyWithGoogle(
  input: CompanySignupInput,
  identity: SessionIdentity,
  deps: { db: CompanyAdminDb }
): Promise<{ companyId: string; adminUserId: string }> {
  if (!hasGoogleIdentity(identity) || !identity.emailConfirmed) {
    throw new DomainRuleError(403, "Reprenez l'inscription avec Google.", "GOOGLE_SESSION_REQUIRED");
  }
  const email = normalizeEmail(identity.email);
  if (await deps.db.user.findFirst({ where: { authId: identity.authId }, select: { id: true } })) {
    throw new DomainRuleError(409, "Ce compte Google est déjà relié à un compte Annona. Connectez-vous.", "EMAIL_EXISTS");
  }
  let prepared: { roleId: string; slug: string };
  try {
    prepared = await prepareCompanyCreation(deps.db, input.companyName, email);
  } catch (error) {
    if (error instanceof DomainRuleError && error.code === "EMAIL_EXISTS") {
      throw new DomainRuleError(409, "Cette adresse a déjà un compte Annona. Connectez-vous.", "EMAIL_EXISTS");
    }
    throw error;
  }
  return insertCompanyWithAdmin(deps.db, {
    name: input.companyName,
    slug: prepared.slug,
    roleId: prepared.roleId,
    companyStatus: "TRIAL",
    ...SIGNUP_COMPANY_DEFAULTS,
    admin: { firstName: input.firstName, lastName: input.lastName, email },
    authId: identity.authId,
    userStatus: "ACTIVE",
  });
}

export type CallbackIntent = "login" | "signup" | "confirm";

export function parseCallbackIntent(value: string | null): CallbackIntent {
  return value === "signup" || value === "confirm" ? value : "login";
}

/**
 * Que faire d'une session ouverte par Google (ou par le lien de confirmation) qui n'a aucun profil Annona.
 * - inscription avec Google : on garde la session pour demander le nom de la boulangerie ;
 * - sinon : adresse inconnue, aucun accès ; le compte de connexion créé par Google est retiré, sinon il
 *   bloquerait la création du compte par un administrateur avec la même adresse.
 */
export function unprovisionedOutcome(intent: CallbackIntent, identity: SessionIdentity): "complete-signup" | "unknown" {
  return intent === "signup" && hasGoogleIdentity(identity) && identity.emailConfirmed ? "complete-signup" : "unknown";
}

/** Seul un compte de connexion né de Google et sans aucun autre moyen de connexion est retiré. */
export function isDisposableGoogleAccount(identity: SessionIdentity): boolean {
  return identity.providers.length > 0 && identity.providers.every((provider) => provider === "google");
}
