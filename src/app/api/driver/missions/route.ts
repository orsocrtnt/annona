import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import {
  getAvailableDeliveriesForDriver,
  getDriverMissions,
  getDriverStats,
} from "@/domains/delivery/delivery.service";

export async function GET() {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const driverId = auth.context.user.id;
  const [missions, available, stats] = await Promise.all([
    getDriverMissions(driverId),
    getAvailableDeliveriesForDriver(companyId),
    getDriverStats(driverId),
  ]);

  return NextResponse.json({ data: { missions, available, stats }, success: true });
}
