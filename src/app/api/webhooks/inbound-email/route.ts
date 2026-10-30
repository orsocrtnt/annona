import { NextResponse } from "next/server";
import { ingestInboundEmail, verifyInboundWebhook } from "@/domains/order-intake/inbound-email.service";

export const runtime = "nodejs";

/** Authentifié par signature, sans session : voir docs/operations/order-intake/README.md. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return new NextResponse(null, { status: 413 });
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() ?? "";
  const body = await request.text();
  const authentic = verifyInboundWebhook(body, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  }, secret);
  if (!authentic) return NextResponse.json({ error: "Événement non authentifié." }, { status: 400 });

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Événement illisible." }, { status: 400 });
  }
  try {
    await ingestInboundEmail(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Inbound email failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "À reprendre." }, { status: 503 });
  }
}
