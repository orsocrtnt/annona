import { NextResponse } from "next/server";
import { reorderCategories } from "@/domains/catalog/catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { reorderCategoriesSchema } from "@/lib/validations/catalog";

/** ADM-02 : ordre d'affichage des catégories (liste complète, dans le nouvel ordre). */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const { ids } = reorderCategoriesSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await reorderCategories(guard.actor.companyId, ids), success: true });
  });
}
