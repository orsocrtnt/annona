import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_PERSONAS } from "@/domains/demo/demo-scenario";
import { DemoLeaseMissingError, openDemoPersonaSession } from "@/domains/demo/demo-session.service";
import { readDemoLeaseCookie } from "@/lib/demo/demo-lease-cookie";

const bodySchema = z.object({ persona: z.enum(DEMO_PERSONAS) });

/** DEMO-1 : ouvre l'espace choisi (commerçant, gérant, boulanger, livreur) de la démo prêtée au visiteur. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Espace inconnu." }, { status: 400 });
  try {
    const session = await openDemoPersonaSession(await readDemoLeaseCookie(), parsed.data.persona);
    return NextResponse.json({ ok: true, redirectTo: session.redirectTo });
  } catch (error) {
    if (error instanceof DemoLeaseMissingError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[demo] ouverture d'espace impossible", error);
    return NextResponse.json({ error: "L'espace n'a pas pu s'ouvrir. Réessayez." }, { status: 500 });
  }
}
