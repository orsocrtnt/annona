import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { assignFromSuggestion, getDispatchSuggestions } from "@/domains/delivery/auto-dispatch.service";
import { assertSaasFeature, assertSaasMutationFeature } from "@/domains/saas/saas.service";

/**
 * DISPATCH-4 — suggestions de livreurs (3 meilleurs, score expliqué) et affectation en un clic.
 * Dispatcher et administrateurs seulement ; option « Dispatch intelligent » requise.
 * Aucune coordonnée ni distance en mètres dans la réponse.
 */
const OPTION_MISSING = "Les suggestions de livreurs font partie de l’option « Dispatch intelligent », non incluse dans cette offre.";

type Authorized = { error: NextResponse } | { companyId: string; readOnly: boolean };

async function authorize(mutation: boolean): Promise<Authorized> {
  const auth = await requireStaffRole("deliveries:dispatch");
  if ("error" in auth) return { error: auth.error as NextResponse };
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return { error: denied };
  const companyId = getCompanyId(auth.context);
  if (!companyId) return { error: NextResponse.json({ error: "Entreprise non associée" }, { status: 400 }) };
  let readOnly = false;
  try {
    const access = mutation
      ? await assertSaasMutationFeature(companyId, "auto_dispatch")
      : await assertSaasFeature(companyId, "auto_dispatch");
    readOnly = access ? !access.canMutate : false;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SAAS_FEATURE_NOT_AVAILABLE" || code === "SAAS_SUBSCRIPTION_REQUIRED") {
      return { error: NextResponse.json({ error: OPTION_MISSING, code: "SAAS_FEATURE_NOT_AVAILABLE" }, { status: 403 }) };
    }
    if (code === "SAAS_ACCOUNT_READ_ONLY") {
      return { error: NextResponse.json({ error: "Le compte est en lecture seule.", code }, { status: 403 }) };
    }
    throw error;
  }
  return { companyId, readOnly };
}

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const auth = await authorize(false);
    if ("error" in auth) return auth.error;
    const deliveryId = new URL(request.url).searchParams.get("deliveryId")?.trim();
    if (!deliveryId) return NextResponse.json({ error: "deliveryId requis" }, { status: 400 });
    const replacesDriverId = new URL(request.url).searchParams.get("replacesDriverId")?.trim() || undefined;
    const result = await getDispatchSuggestions(auth.companyId, deliveryId, undefined, replacesDriverId);
    if (!result) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    return NextResponse.json({ data: { ...result, readOnly: auth.readOnly }, success: true });
  });
}

const assignSchema = z.object({ deliveryId: z.string().min(1), driverId: z.string().min(1), replacesDriverId: z.string().min(1).optional() });

const CONFLICTS: Record<string, string> = {
  DELIVERY_NOT_AVAILABLE: "Cette livraison a déjà été affectée entre-temps. Actualisez la page.",
  DELIVERY_ASSIGNMENT_CONFLICT: "Cette livraison vient d’être modifiée par un autre dispatcher. Actualisez la page.",
  DELIVERY_STATUS_CONFLICT: "L’état de cette livraison a changé. Actualisez la page.",
  DELIVERY_MISSION_STARTED: "La mission a déjà démarré et ne peut plus être réaffectée.",
  DELIVERY_NOT_ASSIGNABLE: "Cette livraison ne peut plus être affectée.",
  DELIVERY_CANCELLED: "Cette livraison est annulée.",
};

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await authorize(true);
    if ("error" in auth) return auth.error;
    const parsed = assignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    try {
      const delivery = await assignFromSuggestion(auth.companyId, parsed.data.deliveryId, parsed.data.driverId, parsed.data.replacesDriverId);
      if (!delivery) return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
      // Réponse minimale : le client relit la file ; rien d'autre ne sort.
      return NextResponse.json({ data: { id: delivery.id, driverId: delivery.driverId, status: delivery.status }, success: true });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message === "DRIVER_NOT_FOUND") {
        return NextResponse.json({ error: "Livreur introuvable", code: "DRIVER_NOT_FOUND" }, { status: 404 });
      }
      // Le livreur proposé n'est plus compatible (charge atteinte entre-temps, règle modifiée).
      for (const code of ["DRIVER_OVER_CAPACITY", "DRIVER_INELIGIBLE"] as const) {
        if (error.message.startsWith(`${code}:`)) {
          return NextResponse.json(
            { error: `Ce livreur n’est plus disponible : ${error.message.slice(code.length + 1)}`, code },
            { status: 409 }
          );
        }
      }
      const message = CONFLICTS[error.message];
      if (message) return NextResponse.json({ error: message, code: error.message }, { status: 409 });
      throw error;
    }
  });
}
