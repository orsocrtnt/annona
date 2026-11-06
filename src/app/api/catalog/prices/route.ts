import { NextResponse } from "next/server";
import { listMerchantPrices, upsertMerchantPrice } from "@/domains/catalog/catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { upsertMerchantPriceSchema } from "@/lib/validations/catalog";

/** ADM-03 : prix spécifiques, filtrés par produit (`?productId=`) ou par client (`?merchantId=`). */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:read");
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const filter = { productId: params.get("productId") ?? undefined, merchantId: params.get("merchantId") ?? undefined };
    return NextResponse.json({ data: await listMerchantPrices(guard.actor.companyId, filter), success: true });
  });
}

/** ADM-03 / RG-05 : crée ou remplace le prix d'un client pour un produit. */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const input = upsertMerchantPriceSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await upsertMerchantPrice(guard.actor.companyId, input), success: true });
  });
}
