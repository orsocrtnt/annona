import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { estimateCourierPrice } from "@/domains/company/courier-estimate.service";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const companyId = auth.context.user.companyId;
    if (!companyId) {
      return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : null);

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
