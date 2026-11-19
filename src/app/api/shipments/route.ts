import { NextResponse } from "next/server";
import { z } from "zod";
import { getShipmentDay, saveShipment } from "@/domains/shop/shipment.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { dayQuerySchema } from "@/lib/validations/order";

/** Lot 2, demande 5 : envois du jour vers les boutiques ; une ligne par produit, quantité 0 = retiré. */
const saveShipmentSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
    shopId: z.string().trim().min(1).max(64),
    lines: z
      .array(z.object({ productId: z.string().trim().min(1).max(64), quantity: z.number().int("Quantité entière.").min(0).max(9_999, "Quantité trop élevée.") }).strict())
      .max(500),
  })
  .strict();

async function guard() {
  // Le pâtissier envoie la pâtisserie, le boulanger le pain (tableau des droits du lot 2) ; jamais l'administrateur.
  const result = await requireCompanyRole(["PASTRY_CHEF", "BAKER"], "shipments:manage");
  if ("error" in result) return result;
  const family = result.actor.user.role.systemRole === "PASTRY_CHEF" ? ("PASTRY" as const) : ("BREAD" as const);
  return { actor: result.actor, family };
}

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const allowed = await guard();
    if ("error" in allowed) return allowed.error;
    const { date } = dayQuerySchema.parse({ date: new URL(request.url).searchParams.get("date") });
    return NextResponse.json({ data: await getShipmentDay(allowed.actor.companyId, allowed.family, date), success: true });
  });
}

export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const allowed = await guard();
    if ("error" in allowed) return allowed.error;
    const input = saveShipmentSchema.parse(await readJsonBody(request));
    const data = await saveShipment({ companyId: allowed.actor.companyId, userId: allowed.actor.user.id, family: allowed.family }, input);
    return NextResponse.json({ data, success: true });
  });
}
