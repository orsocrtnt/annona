import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getRoundProposals, previewRound, RoundRejectedError, validateRound } from "@/domains/delivery/delivery-rounds.service";

/**
 * DISPATCH-4, piste 3 — tournées proposées, recalculées après modification, puis validées.
 * Dispatcher et administrateurs. Aucune coordonnée en réponse.
 */

type Authorized = { error: NextResponse } | { companyId: string };

async function authorize(): Promise<Authorized> {
  const auth = await requireStaffRole("deliveries:dispatch");
  if ("error" in auth) return { error: auth.error as NextResponse };
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return { error: denied };
  const companyId = getCompanyId(auth.context);
  if (!companyId) return { error: NextResponse.json({ error: "Entreprise non associée" }, { status: 400 }) };
  return { companyId };
}

export async function GET() {
  return withApiHandler(async () => {
    const auth = await authorize();
    if ("error" in auth) return auth.error;
    return NextResponse.json({ data: await getRoundProposals(auth.companyId), success: true });
  });
}

const roundSchema = z.object({
  driverId: z.string().min(1),
  stops: z.array(z.object({ deliveryId: z.string().min(1), kind: z.enum(["PICKUP", "DROPOFF"]) })).min(1).max(80),
  dryRun: z.boolean().default(false),
  acceptViolations: z.boolean().default(false),
});

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await authorize();
    if ("error" in auth) return auth.error;
    const parsed = roundSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Tournée invalide" }, { status: 400 });
    const { driverId, stops, dryRun, acceptViolations } = parsed.data;
    try {
      if (dryRun) {
        const { round } = await previewRound(auth.companyId, driverId, stops);
        return NextResponse.json({ data: { status: "PREVIEW", round }, success: true });
      }
      const result = await validateRound(auth.companyId, driverId, stops, acceptViolations);
      return NextResponse.json({ data: result, success: true });
    } catch (error) {
      if (error instanceof RoundRejectedError) {
        const message = error.message === "DRIVER_NOT_FOUND"
          ? "Ce livreur n’est plus disponible. Actualisez la page."
          : "Cette tournée a changé : une livraison a déjà été affectée. Actualisez la page.";
        return NextResponse.json({ error: message, code: error.message }, { status: 409 });
      }
      throw error;
    }
  });
}
