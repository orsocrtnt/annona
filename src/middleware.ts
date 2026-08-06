import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/services/supabase/middleware";
import { AUTH_ROUTES } from "@/lib/constants";

const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/dispatch",
  "/driver",
  "/portal",
  "/settings",
  "/users",
  "/companies",
];

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const isApiRoute = pathname.startsWith("/api");

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
      // Staff déjà connecté : aller au dashboard, pas à l'accueil public
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // N'inclut pas /api ni / : landing publique sans middleware ; routes API gèrent leur auth
  matcher: [
    "/login",
    "/login/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/dispatch/:path*",
    "/driver/:path*",
    "/portal/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/companies/:path*",
  ],
};
