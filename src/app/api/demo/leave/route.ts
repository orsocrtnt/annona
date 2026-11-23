import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { releaseDemoLease } from "@/domains/demo/demo-pool.service";
import { clearDemoLeaseCookie, readDemoLeaseCookie } from "@/lib/demo/demo-lease-cookie";

/** DEMO-1 « Quitter la démo » : déconnexion, environnement rendu (reconstruit au prochain visiteur). */
export async function POST() {
  const token = await readDemoLeaseCookie();
  await (await createClient()).auth.signOut().catch(() => undefined);
  await releaseDemoLease(token);
  await clearDemoLeaseCookie();
  return NextResponse.json({ ok: true });
}
