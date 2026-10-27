import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import {
  deleteCompanyOrder,
  getCompanyOrderById,
  updateCompanyOrderStatus,
} from "@/domains/order/order.service";
import { updateOrderStatusSchema } from "@/lib/validations/order";
import { getPodPhotoSignedUrl } from "@/lib/storage/pod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("orders:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const { id } = await params;
  const order = await getCompanyOrderById(companyId, id);

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const deliveries = await Promise.all(
    order.deliveries.map(async (delivery) => {
      const { podPhotoPath, ...safeDelivery } = delivery;
      return {
        ...safeDelivery,
        podPhotoUrl: await getPodPhotoSignedUrl(podPhotoPath, companyId, delivery.id),
      };
    })
  );

  return NextResponse.json({ data: { ...order, deliveries }, success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("orders:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  let order;
  try {
    order = await updateCompanyOrderStatus(companyId, id, parsed.data.status);
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_STATUS_CONFLICT") {
      return NextResponse.json(
        { error: "Le statut vient d’être modifié. Rechargez la commande." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "ORDER_ASSIGNMENT_REQUIRED") {
      return NextResponse.json(
        { error: "Assignez d’abord un chauffeur depuis le centre de dispatch." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "SPECIAL_QUOTE_TRANSITION_INVALID") {
      return NextResponse.json(
        {
          error:
            "Cette demande doit être confirmée en « En attente » après accord externe, ou annulée.",
          code: error.message,
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "CANCELLATION_REASON_REQUIRED") {
      return NextResponse.json(
        {
          error: "La mission a démarré. Annulez-la depuis la livraison en indiquant un motif.",
          code: error.message,
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "ORDER_PAID") {
      return NextResponse.json(
        { error: "Une facture payée interdit l’annulation de cette commande.", code: error.message },
        { status: 409 }
      );
    }
    if (
      error instanceof Error &&
      [
        "ORDER_NOT_CANCELLABLE",
        "DELIVERY_NOT_CANCELLABLE",
        "DELIVERY_STATUS_CONFLICT",
        "INVOICE_STATUS_CONFLICT",
      ].includes(error.message)
    ) {
      return NextResponse.json(
        {
          error: "La commande a changé ou ne peut plus être annulée. Rechargez-la.",
          code: error.message,
        },
        { status: 409 }
      );
    }
    throw error;
  }

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: order, success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("orders:update");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const { id } = await params;
  let order;
  try {
    order = await deleteCompanyOrder(companyId, id);
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_HAS_OPERATIONAL_HISTORY") {
      return NextResponse.json(
        {
          error: "Seule une demande de devis sans livraison ni facture peut être supprimée.",
          code: error.message,
        },
        { status: 409 }
      );
    }
    throw error;
  }

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
