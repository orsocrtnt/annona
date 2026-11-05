import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformWrite } from "@/lib/api/platform-access";
import { ACCESS_ERROR_MESSAGES, parseAccessAction, setPlatformUserAccess } from "@/domains/admin/account-access.service";

const noStore = { "Cache-Control": "no-store" };

/** Couper ou rétablir l'accès d'un compte (super admin, journalisé). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "USERS", "POST");
  if (blocked) return blocked;

  const action = parseAccessAction(await request.json().catch(() => null));
  if (!action) return NextResponse.json({ error: "Action inconnue." }, { status: 400, headers: noStore });
  const { id } = await params;
  const result = await setPlatformUserAccess(id, action);
  if (!result.ok) {
    const failure = ACCESS_ERROR_MESSAGES[result.code];
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers: noStore });
  }
  return NextResponse.json({ data: { status: result.status }, success: true }, { headers: noStore });
}
