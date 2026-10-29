import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { assignDeliveryToDriver } from "@/domains/delivery/delivery.service";
import { assignDeliverySchema } from "@/lib/validations/delivery";
import { omitStoragePaths } from "@/domains/delivery/proof-links";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("deliveries:dispatch");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;

  try {
    const delivery = await assignDeliveryToDriver(companyId, id, parsed.data.driverId, {
      force: parsed.data.force,
      reason: parsed.data.force ? "Assignation manuelle forcée" : undefined,
    });
    if (!delivery) {
      return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: omitStoragePaths(delivery), success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "DRIVER_NOT_FOUND") {
      return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("DRIVER_OVER_CAPACITY:")) {
      return NextResponse.json(
        {
          error: error.message.replace("DRIVER_OVER_CAPACITY:", ""),
          code: "DRIVER_OVER_CAPACITY",
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message.startsWith("DRIVER_INELIGIBLE:")) {
      return NextResponse.json(
        {
          error: error.message.replace("DRIVER_INELIGIBLE:", ""),
          code: "DRIVER_INELIGIBLE",
        },
        { status: 409 }
      );
    }
    if (error instanceof Error) {
      const conflicts: Record<string, string> = {
        DELIVERY_ASSIGNMENT_CONFLICT:
          "Cette livraison vient d’être modifiée par un autre dispatcher. Actualisez la page.",
        DELIVERY_STATUS_CONFLICT:
          "L’état de cette livraison a changé. Actualisez la page.",
        DELIVERY_MISSION_STARTED:
          "La mission a déjà démarré et ne peut plus être réaffectée.",
        DELIVERY_NOT_ASSIGNABLE:
          "Cette livraison ne peut plus être affectée.",
        DELIVERY_CANCELLED: "Cette livraison est annulée.",
      };
      const message = conflicts[error.message];
      if (message) {
        return NextResponse.json(
          { error: message, code: error.message },
          { status: 409 }
        );
      }
    }
    throw error;
  }
}
