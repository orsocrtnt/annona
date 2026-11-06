import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { ACCESS_ERROR_MESSAGES, parseAccessAction, setPlatformCompanyAccess } from "@/domains/admin/account-access.service";

const noStore = { "Cache-Control": "no-store" };

/** Suspendre ou rétablir une entreprise et tous ses comptes (super admin, journalisé). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  if (denied) return denied;

  const action = parseAccessAction(await request.json().catch(() => null));
  if (!action) return NextResponse.json({ error: "Action inconnue." }, { status: 400, headers: noStore });
  const { id } = await params;
  const result = await setPlatformCompanyAccess(id, action);
  if (!result.ok) {
    const failure = ACCESS_ERROR_MESSAGES[result.code];
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers: noStore });
  }
  return NextResponse.json({ data: { status: result.status }, success: true }, { headers: noStore });
}
