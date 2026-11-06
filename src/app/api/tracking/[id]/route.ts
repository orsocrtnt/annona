import { NextResponse } from "next/server";
import { orderActorAuth } from "@/lib/api/order-actor-auth";
import { OrderAccessError } from "@/domains/order/order-access";
import { getOrderTracking } from "@/domains/tracking/tracking.service";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await orderActorAuth(); if ("error" in auth) return auth.error;
  try { const { id } = await params; return NextResponse.json({ data: await getOrderTracking(auth.actor, id), success: true }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof OrderAccessError ? error.message : "Suivi momentanément indisponible." }, { status: error instanceof OrderAccessError ? error.status : 500 }); }
}
