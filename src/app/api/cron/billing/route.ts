import { NextResponse } from "next/server";
import { sandboxBilling } from "@/domains/billing/billing.service";

/** Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>`. Sans adaptateur sandbox, la route s'arrête sans appeler Stripe. */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (process.env.SIGNUP_PAYMENT_ADAPTER !== "stripe-sandbox") {
    return NextResponse.json({ skipped: true, reason: "adapter" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await sandboxBilling().sweep(25, new URL(request.url).searchParams.get("after") ?? undefined);
    return NextResponse.json(result, { status: result.failed ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Rapprochement indisponible" }, { status: 503 }); }
}
