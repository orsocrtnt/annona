import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/services/supabase/middleware";
import { AUTH_ROUTES } from "@/lib/constants";
import { isCrossOriginMutation, isOriginCheckExempt } from "@/lib/security/origin-check";
import { evaluatePageAccess, getRoleHomePath, isProtectedPagePath } from "@/lib/permissions/page-access";
import { resolveServerAuthForAuthId } from "@/lib/api/server-auth";

/** Page de refus explicite : rôle sans aucun espace ouvert (jamais le HTML de la page demandée). */
function forbiddenPage() {
  return new NextResponse(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Accès refusé</title></head>' +
      '<body><main><h1>Accès refusé</h1><p>Votre compte n’a accès à aucun écran de cet espace.</p>' +
      '<p><a href="/login">Revenir à la connexion</a></p></main></body></html>',
    { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
}

function loginRedirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname.startsWith("/portal")
    ? "/login/client"
    : pathname.startsWith("/driver")
      ? "/login/driver"
      : "/login";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

/** Redirection serveur qui conserve les cookies de session rafraîchis par `updateSession`. */
function redirectWithCookies(request: NextRequest, pathname: string, cookieSource: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const response = NextResponse.redirect(url);
  cookieSource.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Webhook Stripe et crons : authentifiés par signature ou secret, sans session.
  if (isOriginCheckExempt(pathname)) {
    return NextResponse.next();
  }

  if (isCrossOriginMutation(request)) {
    return NextResponse.json({ error: "Origine de la requête refusée." }, { status: 403 });
  }

  const { supabaseResponse, user } = await updateSession(request);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  const isApiRoute = pathname.startsWith("/api");

  // API : header auth-id déjà posé (cache JWT / getClaims, pas de getUser par appel).
  if (isApiRoute) return supabaseResponse;

  if (isProtectedPagePath(pathname)) {
    if (!user) return loginRedirect(request, pathname);
    // AUTH-ROLE : rôle, permissions, modules, compte et entreprise relus en base
    // (jamais depuis le JWT ni les métadonnées utilisateur) avant tout rendu, RSC et préchargement compris.
    const auth = await resolveServerAuthForAuthId(user.id);
    if (!auth) return loginRedirect(request, pathname);
    const decision = evaluatePageAccess(pathname, {
      role: auth.user.role.systemRole,
      permissions: auth.permissions,
      settings: auth.user.settings,
    });
    if (decision.kind === "redirect") {
      return redirectWithCookies(request, decision.location, supabaseResponse);
    }
    if (decision.kind === "forbidden") return forbiddenPage();
    return supabaseResponse;
  }

  if (isAuthRoute && user) {
    // Session valide mais compte inactif, non provisionné ou démo expirée : la page de
    // connexion reste affichée (sinon boucle connexion ↔ espace protégé).
    const auth = await resolveServerAuthForAuthId(user.id);
    if (auth) {
      const home = getRoleHomePath(auth.user.role.systemRole, auth.user.settings);
      const decision = evaluatePageAccess(home, {
        role: auth.user.role.systemRole,
        permissions: auth.permissions,
        settings: auth.user.settings,
      });
      if (decision.kind === "allow") return redirectWithCookies(request, home, supabaseResponse);
    }
  }

  return supabaseResponse;
}

export const config = {
  // Node.js (stable en Next 15.5) : la garde de rôle relit l'utilisateur via Prisma.
  runtime: "nodejs",
  matcher: [
    "/login",
    "/login/:path*",
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/onboarding",
    "/onboarding/:path*",
    "/dispatch",
    "/dispatch/:path*",
    "/driver",
    "/driver/:path*",
    "/portal",
    "/portal/:path*",
    "/settings",
    "/settings/:path*",
    "/support",
    "/support/:path*",
    "/users",
    "/users/:path*",
    "/companies",
    "/companies/:path*",
    "/api/:path*",
  ],
};
