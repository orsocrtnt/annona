import { NextResponse } from "next/server";
import { prisma } from "@/services/prisma/client";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import { AccountUnavailableError } from "@/lib/auth/account-access";
import {
  adoptPendingProfile,
  getDashboardPathForRole,
  syncUserFromSupabase,
  UserNotProvisionedError,
} from "@/domains/auth/auth.service";
import {
  hasGoogleIdentity,
  isDisposableGoogleAccount,
  parseCallbackIntent,
  unprovisionedOutcome,
} from "@/domains/auth/company-signup.service";
import { sessionIdentity } from "@/domains/auth/supabase-signup";

function redirectTo(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, new URL(request.url).origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * AUTH-GOOGLE : retour de « Continuer avec Google » et du lien de confirmation d'une inscription.
 * Le serveur échange le code contre une session, relit le profil en base et ouvre l'espace du rôle.
 * Un compte « en attente » devient actif (adresse prouvée). Une adresse sans compte Annona n'ouvre
 * rien, sauf pendant une inscription avec Google (étape « nom de la boulangerie »).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = parseCallbackIntent(url.searchParams.get("intent"));
  const failure = intent === "confirm" ? "/login?confirmation=lien" : "/login?google=erreur";

  // Refus ou annulation chez Google : aucun code.
  if (url.searchParams.get("error")) return redirectTo(request, intent === "confirm" ? failure : "/login?google=annule");

  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let exchanged = false;
  if (code) {
    exchanged = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && (type === "signup" || type === "email")) {
    exchanged = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  // Lien ouvert dans un autre navigateur : Supabase a déjà confirmé l'adresse, il reste à se connecter.
  if (!exchanged) return redirectTo(request, failure);

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return redirectTo(request, failure);
  const identity = sessionIdentity(authUser);
  if (!identity.emailConfirmed) {
    await supabase.auth.signOut({ scope: "local" });
    return redirectTo(request, failure);
  }

  try {
    const profile = await syncUserFromSupabase({ authId: identity.authId, email: identity.email }, { activatePending: true });
    return redirectTo(request, getDashboardPathForRole(profile.role.systemRole));
  } catch (caught) {
    let error = caught;
    // Compte « en attente » de même adresse resté sur un autre compte de connexion : rattaché à Google.
    if (error instanceof AccountUnavailableError && hasGoogleIdentity(identity)) {
      const adopted = await adoptPendingProfile({ authId: identity.authId, email: identity.email }).catch(() => null);
      if (adopted) {
        if (adopted.previousAuthId) await createAdminClient().auth.admin.deleteUser(adopted.previousAuthId).catch(() => undefined);
        try {
          const profile = await syncUserFromSupabase({ authId: identity.authId, email: identity.email }, { activatePending: true });
          return redirectTo(request, getDashboardPathForRole(profile.role.systemRole));
        } catch (retry) {
          error = retry;
        }
      }
    }
    const unprovisioned = error instanceof UserNotProvisionedError;
    if (unprovisioned && unprovisionedOutcome(intent, identity) === "complete-signup") {
      return redirectTo(request, "/inscription?etape=entreprise");
    }
    await supabase.auth.signOut({ scope: "local" });
    // Compte de connexion né de Google sans profil Annona : retiré, sinon il bloquerait la création
    // du compte par un administrateur avec la même adresse.
    if ((unprovisioned || error instanceof AccountUnavailableError) && isDisposableGoogleAccount(identity)) {
      const linked = await prisma.user.findFirst({ where: { authId: identity.authId }, select: { id: true } }).catch(() => ({ id: "inconnu" }));
      if (!linked) await createAdminClient().auth.admin.deleteUser(identity.authId).catch(() => undefined);
    }
    if (unprovisioned) return redirectTo(request, intent === "confirm" ? failure : "/login?google=inconnu");
    if (error instanceof AccountUnavailableError) return redirectTo(request, "/login?google=indisponible");
    console.error("Auth callback error:", error);
    return redirectTo(request, failure);
  }
}
