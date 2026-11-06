import { NextResponse } from "next/server";
import { updateProduct } from "@/domains/catalog/catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateProductSchema } from "@/lib/validations/catalog";

/** ADM-02 : modifier un produit (nom, unité libre, prix de base, TVA, catégorie, actif). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateProductSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updateProduct(guard.actor.companyId, id, input), success: true });
  });
}
