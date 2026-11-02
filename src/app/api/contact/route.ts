import { after, NextResponse } from "next/server";
import { contactSourceFromHeaders, sendContactAlert, submitContactMessage } from "@/domains/growth/contact.service";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const result = await submitContactMessage(body, contactSourceFromHeaders(request.headers));
    if (result.status === "invalid") {
      return NextResponse.json({ error: "Vérifiez les champs du formulaire.", field: result.field }, { status: 400, headers: NO_STORE });
    }
    if (result.status === "rate_limited") {
      return NextResponse.json(
        { error: "Trop de messages envoyés. Réessayez dans une heure." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": "3600" } }
      );
    }
    const stored = result.stored;
    if (stored) after(async () => { await sendContactAlert(stored); });
    return NextResponse.json({ success: true }, { status: 202, headers: NO_STORE });
  } catch (error) {
    console.error("Contact submission failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Service momentanément indisponible." }, { status: 503, headers: NO_STORE });
  }
}
