import { NextResponse } from "next/server";
import { getCompanyId, requireStaffRole } from "@/lib/api/auth-guard";
import { assignDeliveryToDriver } from "@/domains/delivery/delivery.service";
import { assignDeliverySchema } from "@/lib/validations/delivery";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffRole("deliveries:dispatch");
  if ("error" in auth) return auth.error;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const body = await request.json();
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
    return NextResponse.json({ data: delivery, success: true });
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
    throw error;
  }
}
