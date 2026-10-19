import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getOrderReorderTemplate } from "@/domains/order/order.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const { id } = await params;
  const template = await getOrderReorderTemplate(auth.context.user.id, companyId, id);

  if (!template) {
    return NextResponse.json({ error: "Commande introuvable ou non reproductible" }, { status: 404 });
  }

  return NextResponse.json({ data: template, success: true });
}
