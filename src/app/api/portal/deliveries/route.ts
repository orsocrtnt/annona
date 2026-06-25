import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientDeliveries } from "@/domains/delivery/delivery.service";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const deliveries = await getClientDeliveries(auth.context.user.id);

  return NextResponse.json({ data: deliveries, success: true });
}
