import { NextResponse } from "next/server";
import { createProduct, listProducts } from "@/domains/catalog/catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createProductSchema } from "@/lib/validations/catalog";

/** ADM-02 : produits de l'entreprise (actifs et inactifs) pour le back-office. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listProducts(guard.actor.companyId), success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const input = createProductSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createProduct(guard.actor.companyId, input), success: true }, { status: 201 });
  });
}
