import { NextResponse } from "next/server";
import { ensureDateLocked } from "@/domains/order/order-lock.service";
import { createRound, getRoundsDay } from "@/domains/round/round-admin.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { createRoundSchema, roundsDayQuerySchema } from "@/lib/validations/round";

/**
 * TOUR-1 — tournées d'un jour (ADM-06, ADM-07). Après l'heure limite, la date est d'abord verrouillée
 * (LOCK-1, appel paresseux) pour que les tournées calculées existent.
 */
export async function GET(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:read");
    if ("error" in guard) return guard.error;
    const { date } = roundsDayQuerySchema.parse({ date: new URL(request.url).searchParams.get("date") });
    const day = await ensureDateLocked(guard.actor.companyId, date);
    return NextResponse.json({ data: await getRoundsDay(guard.actor.companyId, day), success: true });
  });
}

/** Nouvelle tournée vide pour un créneau (après l'heure limite seulement). */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("rounds:manage");
    if ("error" in guard) return guard.error;
    const input = createRoundSchema.parse(await readJsonBody(request));
    const data = await createRound({ companyId: guard.actor.companyId, userId: guard.actor.user.id }, input);
    return NextResponse.json({ data, success: true }, { status: 201 });
  });
}
