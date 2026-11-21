import { NextResponse } from "next/server";
import { z } from "zod";
import { getReception, receiveShipment } from "@/domains/shop/shop-stock.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { dayQuerySchema } from "@/lib/validations/order";

async function seller() {
  const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
  if ("error" in guard) return guard;
  const shopId = guard.actor.user.merchantId;
  if (!shopId) return { error: NextResponse.json({ error: "Ce compte vente n'est rattaché à aucune boutique.", success: false }, { status: 403 }) };
  return { actor: { companyId: guard.actor.companyId, userId: guard.actor.user.id, shopId } };
}

const receiveSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
    lines: z
      .array(z.object({ productId: z.string().trim().min(1).max(64), received: z.number().int().min(0).max(9_999), damaged: z.number().int().min(0).max(9_999) }).strict())
      .max(500),
  })
  .strict();

/** Lot 2, demande 6 : envoi du jour de la boutique de la vendeuse, quantités prévues. */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const { date } = dayQuerySchema.parse({ date: new URL(request.url).searchParams.get("date") });
    return NextResponse.json({ data: await getReception(allowed.actor, date), success: true });
  });
}

/** Lot 2, demande 6 : réception notée (reçu, abîmé) ; le bon état entre en stock ; un écart alerte le laboratoire. */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const input = receiveSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await receiveShipment(allowed.actor, input), success: true });
  });
}
