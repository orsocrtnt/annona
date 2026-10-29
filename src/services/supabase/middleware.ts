import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { TUTELLIV_AUTH_ID_HEADER } from "@/lib/auth/auth-headers";

/** Revalide Auth au plus toutes les ~45s par token (pas à chaque clic / API). */
const GATE_MAX_MS = 45_000;
const GATE_REFRESH_SKEW_MS = 20_000;
const GATE_MAX_ENTRIES = 200;

type GateEntry = { authId: string; until: number };

type VerifyResult = {
  authId: string | null;
  exp?: number;
  cookieResponse: NextResponse;
};

const authGate = new Map<string, GateEntry>();
const authGateInflight = new Map<string, Promise<VerifyResult>>();

function hasAuthCookies(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.includes("auth-token") || name.startsWith("sb-"));
}

function authCookieKey(request: NextRequest): string | null {
  const parts = request.cookies
    .getAll()
    .filter(({ name }) => name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (parts.length === 0) return null;
  return parts.map(({ name, value }) => `${name}=${value}`).join("\n");
}

function readGate(key: string): string | null {
  const hit = authGate.get(key);
  if (!hit) return null;
  if (hit.until <= Date.now()) {
    authGate.delete(key);
    return null;
  }
  return hit.authId;
}

function writeGate(key: string, authId: string, jwtExpSec?: number) {
  const fromJwt = jwtExpSec
    ? jwtExpSec * 1000 - GATE_REFRESH_SKEW_MS
    : Date.now() + GATE_MAX_MS;
  const until = Math.min(Date.now() + GATE_MAX_MS, fromJwt);
  if (until <= Date.now()) return;
  authGate.set(key, { authId, until });
  if (authGate.size <= GATE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [cachedKey, entry] of authGate) {
    if (entry.until <= now) authGate.delete(cachedKey);
  }
  if (authGate.size <= GATE_MAX_ENTRIES) return;
  const oldest = authGate.keys().next().value;
  if (oldest) authGate.delete(oldest);
}

function nextWithAuthHeader(request: NextRequest, authId: string | null) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(TUTELLIV_AUTH_ID_HEADER);
  if (authId) {
    requestHeaders.set(TUTELLIV_AUTH_ID_HEADER, authId);
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function copyCookies(from: NextResponse, to: NextResponse) {
  // Options conservées (maxAge, httpOnly, sameSite, suppression) pour les cookies sb-* rafraîchis.
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

function createMiddlewareClient(request: NextRequest) {
  let supabaseResponse = nextWithAuthHeader(request, null);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = nextWithAuthHeader(request, null);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return {
    supabase,
    getCookieResponse: () => supabaseResponse,
  };
}

async function verifyWithSupabase(request: NextRequest): Promise<VerifyResult> {
  const { supabase, getCookieResponse } = createMiddlewareClient(request);

  try {
    const { data: claimsData } = await supabase.auth.getClaims();
    const authId = claimsData?.claims?.sub ?? null;
    const exp =
      typeof claimsData?.claims?.exp === "number" ? claimsData.claims.exp : undefined;

    if (authId) {
      return { authId, exp, cookieResponse: getCookieResponse() };
    }
  } catch {
    // JWT illisible / WebCrypto — fallback getUser
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    authId: user?.id ?? null,
    cookieResponse: getCookieResponse(),
  };
}

function responseWithAuth(
  request: NextRequest,
  authId: string | null,
  cookieSource?: NextResponse
) {
  const authed = nextWithAuthHeader(request, authId);
  if (cookieSource) copyCookies(cookieSource, authed);
  return authed;
}

/**
 * Valide la session sans appeler Auth à chaque navigation.
 * Cache court + getClaims() (JWT local) ; getUser() seulement si le JWT est invalide.
 */
export async function updateSession(request: NextRequest) {
  if (!hasAuthCookies(request)) {
    return {
      supabaseResponse: nextWithAuthHeader(request, null),
      user: null,
    };
  }

  const key = authCookieKey(request);
  if (key) {
    const cachedId = readGate(key);
    if (cachedId) {
      return {
        supabaseResponse: nextWithAuthHeader(request, cachedId),
        user: { id: cachedId },
      };
    }

    let pending = authGateInflight.get(key);
    if (!pending) {
      pending = verifyWithSupabase(request).finally(() => {
        authGateInflight.delete(key);
      });
      authGateInflight.set(key, pending);
    }

    const verified = await pending;
    if (verified.authId) {
      writeGate(key, verified.authId, verified.exp);
    }

    return {
      supabaseResponse: responseWithAuth(
        request,
        verified.authId,
        verified.cookieResponse
      ),
      user: verified.authId ? { id: verified.authId } : null,
    };
  }

  const verified = await verifyWithSupabase(request);
  return {
    supabaseResponse: responseWithAuth(
      request,
      verified.authId,
      verified.cookieResponse
    ),
    user: verified.authId ? { id: verified.authId } : null,
  };
}
