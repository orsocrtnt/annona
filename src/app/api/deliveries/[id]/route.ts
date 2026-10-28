import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { deliveryTiming } from "@/domains/delivery/delivery-timing";
import {
  adminUpdateDelivery,
  getCompanyDeliveryById,
} from "@/domains/delivery/delivery.service";
import { adminUpdateDeliverySchema } from "@/lib/validations/delivery";
import { getPodPhotoSignedUrl } from "@/lib/storage/pod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const { id } = await params;
  const delivery = await getCompanyDeliveryById(companyId, id);

  if (!delivery) {
    return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
  }

  const { podPhotoPath, ...safeDelivery } = delivery;
  return NextResponse.json({
    data: {
      ...safeDelivery,
      podPhotoUrl: await getPodPhotoSignedUrl(podPhotoPath, companyId, delivery.id),
      timing: deliveryTiming({
        status: delivery.status,
        requestedDeliveryDate: delivery.order.requestedDeliveryDate,
        completedAt: delivery.completedAt,
        driverId: delivery.driverId,
        missionAcceptedAt: delivery.missionAcceptedAt,
        hasProof: Boolean(podPhotoPath),
      }),
    },
    success: true,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("deliveries:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = adminUpdateDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  let delivery;
  try {
    delivery = await adminUpdateDelivery(companyId, id, parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "DELIVERY_ASSIGNMENT_REQUIRED") {
      return NextResponse.json(
        { error: "Assignez d’abord un chauffeur depuis le centre de dispatch." },
        { status: 409 }
      );
    }
    if (error instanceof Error) {
      const conflicts: Record<string, string> = {
        DELIVERY_MISSION_STARTED:
          "La mission a déjà démarré. Elle ne peut plus être retirée ni réaffectée.",
        DELIVERY_NOT_ASSIGNABLE:
          "Cette livraison ne peut plus être modifiée depuis le dispatch.",
        DELIVERY_NOT_CANCELLABLE:
          "Cette livraison est terminée et ne peut plus être annulée.",
        DELIVERY_STATUS_CONFLICT:
          "L’état de cette livraison a changé. Actualisez la page.",
        DELIVERY_UPDATE_CONFLICT:
          "Cette action doit être effectuée séparément pour préserver l’historique.",
        ORDER_STATUS_CONFLICT:
          "L’état de la commande a changé. Actualisez la page.",
        CANCELLATION_REASON_REQUIRED:
          "Indiquez un motif pour annuler une mission déjà démarrée.",
        DELIVERY_PAID:
          "Cette livraison est liée à une facture payée et ne peut pas être annulée.",
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

  if (!delivery) {
    return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: delivery, success: true });
}
