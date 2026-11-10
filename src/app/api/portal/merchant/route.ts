import { NextResponse } from "next/server";
import { getMerchantProfile, updateMerchantAccessInstructions } from "@/domains/order/merchant-catalog.service";
import { merchantRef } from "@/lib/api/merchant-ref";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireMerchantActor } from "@/lib/api/tenant-auth";
import { merchantAccessSchema } from "@/lib/validations/order";

/** CLI-02 : profil du commerce du client connecté. */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    return NextResponse.json({ data: await getMerchantProfile(merchantRef(guard.actor)), success: true });
  });
}

/** Lot 1, demande 8 : le client modifie ses consignes d'accès (500 caractères au plus). */
export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireMerchantActor();
    if ("error" in guard) return guard.error;
    const input = merchantAccessSchema.parse(await readJsonBody(request));
    return NextResponse.json({ data: await updateMerchantAccessInstructions(merchantRef(guard.actor), input.accessInstructions), success: true });
  });
}
