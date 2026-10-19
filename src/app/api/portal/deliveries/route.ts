import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientDeliveries } from "@/domains/delivery/delivery.service";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const deliveries = await getClientDeliveries(auth.context.user.id, companyId);

  return NextResponse.json({ data: deliveries, success: true });
}
