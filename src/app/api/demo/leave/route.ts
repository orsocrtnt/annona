import { after, NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { prepareSpareDemoEnvironment, releaseDemoLease } from "@/domains/demo/demo-pool.service";
import { clearDemoLeaseCookie, readDemoLeaseCookie } from "@/lib/demo/demo-lease-cookie";

/**
 * DEMO-1 « Quitter la démo » ou déconnexion : session fermée, environnement rendu, puis une démo remise à neuf
 * est préparée après la réponse pour le visiteur suivant.
 */
export async function POST() {
  const token = await readDemoLeaseCookie();
  await (await createClient()).auth.signOut().catch(() => undefined);
  await releaseDemoLease(token);
  await clearDemoLeaseCookie();
  if (token) after(() => prepareSpareDemoEnvironment().catch((error) => console.error("[demo] réserve non préparée", error)));
  return NextResponse.json({ ok: true });
}
