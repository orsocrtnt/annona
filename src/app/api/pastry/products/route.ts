import { NextResponse } from "next/server";
import { listCategories } from "@/domains/catalog/catalog.service";
import { createPastryProduct, listLabProducts } from "@/domains/catalog/lab-catalog.service";
import { shopPricesByProduct } from "@/domains/shop/shop-prices.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { createPastryProductSchema } from "@/lib/validations/catalog";

/**
 * Lot 2, demandes 3 et 4 : pâtisseries de l'entreprise pour le pâtissier, avec recette et prix (restaurant et
 * boutiques) en lecture seule.
 */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["PASTRY_CHEF"], "catalog:pastry");
    if ("error" in guard) return guard.error;
    const [products, categories] = await Promise.all([listLabProducts(guard.actor.companyId, "PASTRY"), listCategories(guard.actor.companyId)]);
    const shopPrices = await shopPricesByProduct(guard.actor.companyId, products.map((product) => product.id));
    const data = {
      products: products.map((product) => ({ ...product, shopPrices: shopPrices.get(product.id) ?? [] })),
      categories: categories.filter((category) => category.family === "PASTRY"),
    };
    return NextResponse.json({ data, success: true });
  });
}

/** Lot 2, demande 3 : le pâtissier crée une pâtisserie (aucun prix). */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["PASTRY_CHEF"], "catalog:pastry");
    if ("error" in guard) return guard.error;
    const input = createPastryProductSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await createPastryProduct(guard.actor.companyId, input), success: true }, { status: 201 });
  });
}
