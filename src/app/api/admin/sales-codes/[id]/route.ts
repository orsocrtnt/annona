import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import { disableSalesCode, getSalesCodeHistory } from "@/domains/sales/sales-code.service";

const noStore = { "Cache-Control": "no-store" };

/** Historique des attributions et commissions théoriques d'un code. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "SALES_COMMISSIONS");
  if (blocked) return blocked;

  const { id } = await context.params;
  if (!id || id.length > 64) return NextResponse.json({ error: "Code introuvable" }, { status: 404, headers: noStore });
  const data = await getSalesCodeHistory(id);
  if (!data) return NextResponse.json({ error: "Code introuvable" }, { status: 404, headers: noStore });
  return NextResponse.json({ data, success: true }, { headers: noStore });
}

/** Désactivation définitive d'un code ; les attributions déjà figées restent. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "SALES_CODES", "PATCH");
  if (blocked) return blocked;

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const { id } = await context.params;
  if (body?.action !== "disable" || !id || id.length > 64) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400, headers: noStore });
  }
  const result = await disableSalesCode(id, auth.context.user.id);
  if (result.status === "not_found") return NextResponse.json({ error: "Code introuvable" }, { status: 404, headers: noStore });
  if (result.status === "already_disabled") {
    return NextResponse.json({ error: "Ce code est déjà désactivé." }, { status: 409, headers: noStore });
  }
  return NextResponse.json({ success: true }, { headers: noStore });
}
