import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { estimateCourierPrice } from "@/domains/company/courier-estimate.service";

const text = z.string().max(500).nullish();
const estimateSchema = z.object({
  pickupAddress: text, pickupCity: text, pickupPostalCode: text,
  shippingAddress: text, shippingCity: text, shippingPostalCode: text,
  requestedDeliveryDate: z.string().max(40).nullish(),
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
    const str = (v: string | null | undefined) => v ?? null;

    const result = await estimateCourierPrice(companyId, {
      pickup: {
        address: str(body.pickupAddress),
        city: str(body.pickupCity),
        postalCode: str(body.pickupPostalCode),
      },
      shipping: {
        address: str(body.shippingAddress),
        city: str(body.shippingCity),
        postalCode: str(body.shippingPostalCode),
      },
      requestedDeliveryDate: str(body.requestedDeliveryDate),
    });

    return NextResponse.json({ data: result, success: true });
  });
}
