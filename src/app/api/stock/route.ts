import { NextResponse } from "next/server";
import { getShopStock } from "@/domains/shop/shop-stock.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";

/**
 * Lot 2, demande 8 : écran « Stock boutiques » de l'administrateur (tout), du pâtissier (pâtisserie) et du
 * boulanger (pain). `shopId` vide : toutes les boutiques ; `date` : jour consulté (la veille par défaut).
 */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["ADMIN", "PASTRY_CHEF", "BAKER"], "shops:read");
    if ("error" in guard) return guard.error;
    const params = new URL(request.url).searchParams;
    const role = guard.actor.user.role.systemRole;
    const family = role === "PASTRY_CHEF" ? "PASTRY" : role === "BAKER" ? "BREAD" : null;
    const data = await getShopStock(guard.actor.companyId, { shopId: params.get("shopId") || null, date: params.get("date") || null, family });
    return NextResponse.json({ data, success: true });
  });
}
