import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { getDriverMissionNavigation } from "@/domains/delivery/driver-navigation.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const { id } = await params;
  const navigation = await getDriverMissionNavigation(auth.context.user.id, companyId, id);

  if (!navigation) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: navigation, success: true });
}
