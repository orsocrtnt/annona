import "server-only";
import { cookies } from "next/headers";
import { DEMO_LEASE_COOKIE, DEMO_LEASE_MS } from "@/lib/demo/demo-constants";

/** Cookie de prêt de démo (DEMO-1) : HttpOnly, jamais lisible par le script de la page. */
export async function readDemoLeaseCookie(): Promise<string | undefined> {
  return (await cookies()).get(DEMO_LEASE_COOKIE)?.value;
}

export async function writeDemoLeaseCookie(token: string) {
  (await cookies()).set(DEMO_LEASE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DEMO_LEASE_MS / 1000),
  });
}

export async function clearDemoLeaseCookie() {
  (await cookies()).delete(DEMO_LEASE_COOKIE);
}
