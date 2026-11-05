/**
 * ADMIN-ESPACE lot 2 : visites et clics « Rejoindre la liste » de /tarifs, comptés par jour et par campagne.
 * Route publique sans cookie ni session ; rien d'identifiant n'est écrit (voir waitlist-funnel.service.ts).
 */
import { NextResponse } from "next/server";
import { contactSourceFromHeaders } from "@/domains/growth/contact.service";
import { FUNNEL_BODY_MAX_BYTES, recordFunnelBeacon } from "@/domains/growth/waitlist-funnel.service";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > FUNNEL_BODY_MAX_BYTES) {
    return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413, headers: NO_STORE });
  }
  const text = await request.text().catch(() => "");
  if (text.length > FUNNEL_BODY_MAX_BYTES) {
    return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413, headers: NO_STORE });
  }
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  try {
    const result = await recordFunnelBeacon(body, {
      userAgent: request.headers.get("user-agent"),
      source: contactSourceFromHeaders(request.headers),
    });
    if (result === "invalid") return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers: NO_STORE });
    if (result === "limited") return NextResponse.json({ error: "Trop de requêtes." }, { status: 429, headers: NO_STORE });
    // Robot ignoré ou événement compté : même réponse, sans contenu.
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    console.error("Funnel event failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Service momentanément indisponible." }, { status: 503, headers: NO_STORE });
  }
}
