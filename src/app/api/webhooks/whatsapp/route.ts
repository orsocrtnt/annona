import { NextResponse } from "next/server";
import {
  ingestWhatsAppWebhook,
  verifyWhatsAppSignature,
  whatsappConfig,
  whatsappSubscribeChallenge,
} from "@/domains/order-intake/whatsapp.service";

export const runtime = "nodejs";

/** WHATSAPP-1 : abonnement du webhook par Meta (jeton de vérification), sans session. */
export async function GET(request: Request) {
  const challenge = whatsappSubscribeChallenge(new URL(request.url).searchParams, whatsappConfig().verifyToken);
  if (!challenge) return new NextResponse(null, { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

/** Authentifié par signature (`X-Hub-Signature-256`), sans session : voir docs/operations/order-intake/WHATSAPP.md. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return new NextResponse(null, { status: 413 });
  const body = await request.text();
  if (!verifyWhatsAppSignature(body, request.headers.get("x-hub-signature-256"), whatsappConfig().appSecret)) {
    return NextResponse.json({ error: "Événement non authentifié." }, { status: 401 });
  }
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Événement illisible." }, { status: 400 });
  }
  try {
    await ingestWhatsAppWebhook(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("WhatsApp webhook failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "À reprendre." }, { status: 503 });
  }
}
