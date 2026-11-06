import { NextResponse } from "next/server";
import { prisma } from "@/services/prisma/client";
import { sandboxBilling } from "@/domains/billing/billing.service";
import { assertStripeSandbox, verifyStripeEvent } from "@/domains/billing/stripe-sandbox";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let event;
  try {
    assertStripeSandbox();
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return new NextResponse(null, { status: 413 });
    event = verifyStripeEvent(await request.text(), request.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET!);
  } catch { return NextResponse.json({ error: "Événement non authentifié." }, { status: 400 }); }
  if (!/^(checkout\.session\.|customer\.subscription\.|invoice\.|charge\.refunded|refund\.)/.test(event.type)) return NextResponse.json({ received: true });
  try {
    const data = event.object;
    const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {};
    const accountId = typeof metadata.annona_account === "string" ? metadata.annona_account : null;
    const customer = typeof data.customer === "string" ? data.customer : null;
    const subscription = data.object === "subscription" && typeof data.id === "string" ? data.id : typeof data.subscription === "string" ? data.subscription : null;
    const conditions = [accountId ? { id: accountId } : null, customer ? { providerCustomerId: customer } : null, subscription ? { providerSubscriptionId: subscription } : null].filter((item): item is NonNullable<typeof item> => item !== null);
    if (!conditions.length) return NextResponse.json({ received: true });
    const account = await prisma.saasBillingAccount.findFirst({ where: { OR: conditions } });
    if (!account) return NextResponse.json({ received: true });
    await sandboxBilling().reconcile(account.id, event.id);
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Rapprochement à reprendre." }, { status: 503 }); }
}
