import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { claimDeliveryByDriver } from "@/domains/delivery/delivery.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const delivery = await claimDeliveryByDriver(companyId, auth.context.user.id, id);
    if (!delivery) {
      return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    }
    return NextResponse.json({ data: delivery, success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "DISPATCH_ONLY") {
      return NextResponse.json(
        { error: "Les missions sont assignées par le dispatch." },
        { status: 403 }
      );
    }
    if (
      error instanceof Error &&
      (error.message === "DELIVERY_NOT_AVAILABLE" ||
        error.message === "DELIVERY_ALREADY_ASSIGNED")
    ) {
      return NextResponse.json(
        { error: "Cette livraison n'est plus disponible." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "DELIVERY_CANCELLED") {
      return NextResponse.json({ error: "Livraison annulée." }, { status: 400 });
    }
    throw error;
  }
}
