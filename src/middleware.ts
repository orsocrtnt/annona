import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/services/supabase/middleware";
import { AUTH_ROUTES } from "@/lib/constants";

const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/onboarding",
  "/dispatch",
  "/driver",
  "/portal",
  "/settings",
  "/support",
  "/users",
  "/companies",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isCronRoute = pathname.startsWith("/api/cron/");

  if (isCronRoute) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isApiRoute = pathname.startsWith("/api");

  // API : header auth-id déjà posé (cache JWT / getClaims, pas de getUser par appel).
  if (isApiRoute) return supabaseResponse;

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/portal")
      ? "/login/client"
      : pathname.startsWith("/driver")
        ? "/login/driver"
        : "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    if (pathname === "/login/client") {
      url.pathname = "/portal";
    } else if (pathname === "/login/driver") {
      url.pathname = "/driver";
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
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
