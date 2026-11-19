import { NextResponse } from "next/server";
import { settleCakeOrder } from "@/domains/shop/cake-order.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";

async function seller() {
  const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
  if ("error" in guard) return guard;
  const shopId = guard.actor.user.merchantId;
  if (!shopId) return { error: NextResponse.json({ error: "Ce compte vendeuse n'est rattaché à aucune boutique.", success: false }, { status: 403 }) };
  return { actor: { companyId: guard.actor.companyId, userId: guard.actor.user.id, shopId } };
}

/** Lot 2, demande 9, vérification 5 : au retrait, la commande est marquée « soldée ». */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const { id } = await params;
    return NextResponse.json({ data: await settleCakeOrder(allowed.actor, id), success: true });
  });
}
