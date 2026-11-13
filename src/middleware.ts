import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/services/supabase/middleware";
import { AUTH_ROUTES } from "@/lib/constants";
import { isCrossOriginMutation, isOriginCheckExempt } from "@/lib/security/origin-check";
import {
  evaluatePageAccess,
  getHomePath,
  isProtectedPagePath,
  type PageAccessSubject,
} from "@/lib/permissions/page-access";
import { resolveServerAuthForAuthId } from "@/lib/api/server-auth";
import { miniAdminModules } from "@/lib/permissions/mini-admin";

const NO_STORE = "no-store";

/**
 * Sujet de la garde de pages mémorisé 5 s par authId + persona + session de démo :
 * absorbe les rafales de préchargement (une relecture en base au lieu d'une par lien).
 * Les API relisent toujours la base : une suspension reste immédiate pour les données.
 */
const SUBJECT_TTL_MS = 5_000;
const SUBJECT_MAX_ENTRIES = 500;
const subjectCache = new Map<string, { subject: PageAccessSubject | null; until: number }>();
const subjectInflight = new Map<string, Promise<PageAccessSubject | null>>();

async function loadSubject(authId: string): Promise<PageAccessSubject | null> {
  const auth = await resolveServerAuthForAuthId(authId);
  if (!auth) return null;
  // Lot 1, demande 4 : fonctionnalités d'un mini admin, relues en base comme le rôle.
  return { role: auth.user.role.systemRole, permissions: auth.permissions, modules: miniAdminModules(auth.user) };
}

async function resolvePageSubject(request: NextRequest, authId: string): Promise<PageAccessSubject | null> {
  const key = authId;
  const now = Date.now();
  const hit = subjectCache.get(key);
  if (hit && hit.until > now) return hit.subject;
  let pending = subjectInflight.get(key);
  if (!pending) {
    pending = loadSubject(authId).finally(() => subjectInflight.delete(key));
    subjectInflight.set(key, pending);
  }
  const subject = await pending;
  subjectCache.delete(key); // réinsertion en fin de Map : l'éviction vise les entrées les plus anciennes
  subjectCache.set(key, { subject, until: Date.now() + SUBJECT_TTL_MS });
  if (subjectCache.size > SUBJECT_MAX_ENTRIES) {
    for (const [cachedKey, entry] of subjectCache) {
      if (entry.until <= Date.now() || subjectCache.size > SUBJECT_MAX_ENTRIES) subjectCache.delete(cachedKey);
      if (subjectCache.size <= SUBJECT_MAX_ENTRIES) break;
    }
  }
  return subject;
}

/** Recopie les cookies de session rafraîchis par `updateSession` (rotation du refresh token). */
function withSessionCookies(response: NextResponse, cookieSource: NextResponse) {
  cookieSource.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/** Page de refus explicite : rôle sans aucun espace ouvert (jamais le HTML de la page demandée). */
function refusalPage(status: 403 | 503, title: string, message: string) {
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body><main><h1>${title}</h1><p>${message}</p>` +
      '<p><a href="/login">Revenir à la connexion</a></p></main></body></html>',
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
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

/** Même valeur que `ACCESS_REFUSED_PARAM` (`src/lib/permissions/access-refused.ts`), lue par la page d'arrivée. */
const ACCESS_REFUSED_PARAM = "acces-refuse";

function redirectTo(request: NextRequest, pathname: string, notice?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (notice) url.searchParams.set(notice, "1");
  return NextResponse.redirect(url);
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
    if (!user) return withSessionCookies(loginRedirect(request, pathname), supabaseResponse);
    // AUTH-ROLE : rôle, permissions, modules, compte et entreprise relus en base
    // (jamais depuis le JWT ni les métadonnées utilisateur) avant tout rendu, RSC et préchargement compris.
    let subject: PageAccessSubject | null;
    try {
      subject = await resolvePageSubject(request, user.id);
    } catch {
      // Base indisponible : refus sans rendu (jamais d'ouverture par défaut).
      return withSessionCookies(
        refusalPage(503, "Service momentanément indisponible", "Réessayez dans quelques instants."),
        supabaseResponse
      );
    }
    if (!subject) return withSessionCookies(loginRedirect(request, pathname), supabaseResponse);
    const decision = evaluatePageAccess(pathname, subject);
    if (decision.kind === "redirect") {
      // Page d'un autre rôle : l'accueil affiche pourquoi on y revient (le renvoi était silencieux).
      // « /dashboard » est l'adresse par défaut des liens génériques : pas de message pour elle.
      const notice = pathname === "/dashboard" ? undefined : ACCESS_REFUSED_PARAM;
      return withSessionCookies(redirectTo(request, decision.location, notice), supabaseResponse);
    }
    if (decision.kind === "forbidden") {
      return withSessionCookies(
        refusalPage(403, "Accès refusé", "Votre compte n’a accès à aucun écran de cet espace."),
        supabaseResponse
      );
    }
    return supabaseResponse;
  }

  if (isAuthRoute && user) {
    // Session valide mais compte inactif, non provisionné ou démo expirée : la page de
    // connexion reste affichée (sinon boucle connexion ↔ espace protégé). Base indisponible : idem.
    const subject = await resolvePageSubject(request, user.id).catch(() => null);
    if (subject) {
      const home = getHomePath(subject);
      if (evaluatePageAccess(home, subject).kind === "allow") {
        return withSessionCookies(redirectTo(request, home), supabaseResponse);
      }
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
    "/inscription",
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/bakery",
    "/bakery/:path*",
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
