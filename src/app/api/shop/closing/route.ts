import { NextResponse } from "next/server";
import { z } from "zod";
import { closeDay, getCloseSheet } from "@/domains/shop/shop-stock.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { dayQuerySchema } from "@/lib/validations/order";

async function seller() {
  const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
  if ("error" in guard) return guard;
  const shopId = guard.actor.user.merchantId;
  if (!shopId) return { error: NextResponse.json({ error: "Ce compte n'est rattaché à aucune boutique.", success: false }, { status: 403 }) };
  return { actor: { companyId: guard.actor.companyId, userId: guard.actor.user.id, shopId } };
}

const closeSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
    entries: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(64),
            remaining: z.number().int().min(0).max(99_999),
            damaged: z.number().int().min(0).max(99_999),
            discardExpired: z.number().int().min(0).max(99_999).nullable().optional(),
          })
          .strict()
      )
      .max(1000),
  })
  .strict();

/** Lot 2, demande 7 : produits à compter le soir dans la boutique de la vendeuse, avec leurs lots. */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const { date } = dayQuerySchema.parse({ date: new URL(request.url).searchParams.get("date") });
    return NextResponse.json({ data: await getCloseSheet(allowed.actor, date), success: true });
  });
}

/** Lot 2, demande 7 : clôture du soir (reste, abîmés, fin de vente confirmée) ; ventes calculées. */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const input = closeSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await closeDay(allowed.actor, input), success: true });
  });
}
