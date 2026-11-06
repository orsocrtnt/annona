import { NextResponse } from "next/server";
import { createCategory, listCategories } from "@/domains/catalog/catalog.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createCategorySchema } from "@/lib/validations/catalog";

/** ADM-02 : catégories de l'entreprise, dans l'ordre d'affichage. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:read");
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await listCategories(guard.actor.companyId), success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const input = createCategorySchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createCategory(guard.actor.companyId, input), success: true }, { status: 201 });
  });
}
