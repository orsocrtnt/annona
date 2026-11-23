import { NextResponse } from "next/server";
import { DemoPoolFullError, findDemoLease, leaseDemoEnvironment } from "@/domains/demo/demo-pool.service";
import { readDemoLeaseCookie, writeDemoLeaseCookie } from "@/lib/demo/demo-lease-cookie";

/** Reconstruire une journée prend quelques secondes. */
export const maxDuration = 60;

/**
 * DEMO-1 : prête un environnement de démo au visiteur (ou garde le sien s'il est encore valable),
 * reconstruit à l'heure du moment. Ouvert à tous, sans identifiants.
 */
export async function POST() {
  const current = await findDemoLease(await readDemoLeaseCookie());
  if (current) return NextResponse.json({ ok: true, reused: true, expiresAt: current.leaseExpiresAt });
  try {
    const lease = await leaseDemoEnvironment();
    await writeDemoLeaseCookie(lease.token);
    return NextResponse.json({ ok: true, reused: false, expiresAt: lease.expiresAt });
  } catch (error) {
    if (error instanceof DemoPoolFullError) {
      return NextResponse.json({ error: "Toutes les démos sont prises pour le moment. Réessayez dans quelques minutes." }, { status: 503 });
    }
    console.error("[demo] préparation impossible", error);
    return NextResponse.json({ error: "La démo n'a pas pu être préparée. Réessayez dans un instant." }, { status: 500 });
  }
}
