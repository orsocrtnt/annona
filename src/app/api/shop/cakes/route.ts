import { NextResponse } from "next/server";
import { z } from "zod";
import { createCakeOrder, listCakeChoices, listCakeOrders, readCakeLeadHours } from "@/domains/shop/cake-order.service";
import { companyToday } from "@/domains/order/order-deadline";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { prisma } from "@/services/prisma/client";

async function seller() {
  const guard = await requireCompanyRole(["SELLER"], "dashboard:shop");
  if ("error" in guard) return guard;
  const shopId = guard.actor.user.merchantId;
  if (!shopId) return { error: NextResponse.json({ error: "Ce compte n'est rattaché à aucun point de vente.", success: false }, { status: 403 }) };
  return { actor: { companyId: guard.actor.companyId, userId: guard.actor.user.id, shopId } };
}

/** Lot 2, demande 9 : saisie d'une commande ; le prix ne vient jamais du client (prix boutique de la taille). */
const createSchema = z
  .object({
    productId: z.string().trim().min(1).max(64),
    sizeId: z.string().trim().min(1).max(64),
    inscription: z.string().trim().max(120, "Inscription : 120 caractères au plus.").nullable(),
    // RETOURS-2 : allergies ou instructions, facultatives.
    note: z.string().trim().max(500, "Allergies / instructions : 500 caractères au plus.").nullable().optional(),
    servings: z.number().int().min(1, "1 part au moins.").max(200),
    payment: z.enum(["FULL", "DEPOSIT"]),
    depositCents: z.number().int().min(0).max(10_000_000).nullable(),
    customerName: z.string().trim().min(1, "Nom du client : obligatoire.").max(120),
    customerPhone: z.string().trim().min(6, "Téléphone du client : obligatoire.").max(40),
    pickupAt: z.string().datetime({ offset: true, message: "Date et heure de retrait invalides." }),
  })
  .strict();

/** Gâteaux commandables (avec prix boutique), commandes à venir et délai minimum. */
export async function GET() {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const company = await prisma.company.findUnique({ where: { id: allowed.actor.companyId }, select: { timezone: true, settings: true } });
    const today = companyToday(new Date(), company?.timezone ?? "Europe/Paris");
    const [choices, orders] = await Promise.all([
      listCakeChoices(allowed.actor.companyId, allowed.actor.shopId),
      listCakeOrders(allowed.actor.companyId, allowed.actor.shopId, today),
    ]);
    return NextResponse.json({ data: { choices, orders, leadHours: readCakeLeadHours(company?.settings) }, success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const allowed = await seller();
    if ("error" in allowed) return allowed.error;
    const input = createSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createCakeOrder(allowed.actor, input), success: true }, { status: 201 });
  });
}
