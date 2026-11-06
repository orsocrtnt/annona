import { NextResponse } from "next/server";
import { updateCategory } from "@/domains/catalog/catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { updateCategorySchema } from "@/lib/validations/catalog";

/** ADM-02 : renommer ou (dés)activer une catégorie de l'entreprise. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const input = updateCategorySchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updateCategory(guard.actor.companyId, id, input), success: true });
  });
}
