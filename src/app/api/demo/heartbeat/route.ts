import { NextResponse } from "next/server";
import { touchDemoPoolLease } from "@/domains/demo/demo-pool.service";
import { getDemoSessionCookie } from "@/lib/demo/persona-cookie";

/** Signe de vie d'une démo ouverte (onglet visible) : sert seulement au compteur « en direct » du super admin. */
export async function POST() {
  const sessionId = await getDemoSessionCookie();
  if (!sessionId) return new NextResponse(null, { status: 204 });
  try {
    await touchDemoPoolLease(sessionId);
  } catch (error) {
    console.error("Demo heartbeat failed:", error);
  }
  return new NextResponse(null, { status: 204 });
}
