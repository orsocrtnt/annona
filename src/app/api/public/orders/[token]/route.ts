import { NextResponse } from "next/server";
import { contactSourceFromHeaders } from "@/domains/growth/contact.service";
import { submitPublicOrder } from "@/domains/public-order/public-order.service";

const NO_STORE = { "Cache-Control": "no-store" };

/** Route sans session : le jeton du lien désigne l'entreprise, jamais le corps de la requête. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  try {
    const result = await submitPublicOrder(token, body, contactSourceFromHeaders(request.headers));
    switch (result.status) {
      case "created":
        return NextResponse.json({ success: true, data: { reference: result.reference, trackingUrl: result.trackingUrl } }, { status: 201, headers: NO_STORE });
      case "ignored":
        return NextResponse.json({ success: true, data: { reference: "", trackingUrl: "" } }, { status: 201, headers: NO_STORE });
      case "not_found":
        return NextResponse.json({ error: "Ce lien de commande n'est plus actif." }, { status: 404, headers: NO_STORE });
      case "invalid":
        return NextResponse.json({ error: "Vérifiez les champs du formulaire.", field: result.field }, { status: 400, headers: NO_STORE });
      case "slot_invalid":
        return NextResponse.json({ error: result.message, field: "requestedDeliverySlot" }, { status: 400, headers: NO_STORE });
      case "rate_limited":
        return NextResponse.json({ error: "Trop de commandes envoyées. Réessayez dans une heure." }, { status: 429, headers: { ...NO_STORE, "Retry-After": "3600" } });
      case "unavailable":
        return NextResponse.json({ error: "Ce transporteur ne prend pas de commande pour le moment." }, { status: 503, headers: NO_STORE });
    }
  } catch (error) {
    console.error("Public order failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Service momentanément indisponible." }, { status: 503, headers: NO_STORE });
  }
}
