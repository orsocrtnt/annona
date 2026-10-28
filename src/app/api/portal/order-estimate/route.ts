import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { estimateCourierPrice } from "@/domains/company/courier-estimate.service";

// Champ absent ou null : null pour le service d'estimation.
const text = z.string().max(500).nullish().transform((value) => value ?? null);
const estimateSchema = z.object({
  pickupAddress: text, pickupCity: text, pickupPostalCode: text,
  shippingAddress: text, shippingCity: text, shippingPostalCode: text,
  requestedDeliveryDate: z.string().max(40).nullish().transform((value) => value ?? null),
}).strict();

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const companyId = auth.context.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const parsed = estimateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données d'estimation invalides." }, { status: 400 });
    }
    const body = parsed.data;

    const result = await estimateCourierPrice(companyId, {
      pickup: { address: body.pickupAddress, city: body.pickupCity, postalCode: body.pickupPostalCode },
      shipping: { address: body.shippingAddress, city: body.shippingCity, postalCode: body.shippingPostalCode },
      requestedDeliveryDate: body.requestedDeliveryDate,
    });

    return NextResponse.json({ data: result, success: true });
  });
}
