import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { TUTELLIV_AUTH_ID_HEADER } from "@/lib/auth/auth-headers";

function hasAuthCookies(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.includes("auth-token") || name.startsWith("sb-"));
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

export async function updateSession(request: NextRequest) {
  // Pas de cookie auth → pas d'appel getUser()
  if (!hasAuthCookies(request)) {
    return {
      supabaseResponse: nextWithAuthHeader(request, null),
      user: null,
    };
  }

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Preserve auth header forwarding when refreshing cookies
          supabaseResponse = nextWithAuthHeader(request, null);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reconstruit la réponse avec l'auth id pour que getServerAuth évite un 2e getUser()
  const authedResponse = nextWithAuthHeader(request, user?.id ?? null);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    authedResponse.cookies.set(cookie.name, cookie.value);
  });

  return { supabaseResponse: authedResponse, user };
}
