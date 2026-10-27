import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead, gatePlatformWrite } from "@/lib/api/platform-access";
import { createSalesCode, listSalesCodes, parseSalesCodeListParams } from "@/domains/sales/sales-code.service";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "SALES_CODES");
  if (blocked) return blocked;

  const parsed = parseSalesCodeListParams(new URL(request.url).searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400, headers: noStore });

  const data = await listSalesCodes(parsed.query);
  return NextResponse.json({ data, success: true }, { headers: noStore });
}

/** SALES-1, décision C10 : seul le super-administrateur crée un code, journalisé avant toute écriture. */
export async function POST(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "SALES_CODES", "POST");
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const result = await createSalesCode(body, auth.context.user.id);
  if (result.status === "invalid") {
    return NextResponse.json({ error: "Vérifiez le nom, l'adresse et le niveau.", field: result.field }, { status: 400, headers: noStore });
  }
  if (result.status === "seller_has_code") {
    return NextResponse.json({ error: "Ce commercial a déjà un code." }, { status: 409, headers: noStore });
  }
  return NextResponse.json({ data: result.salesCode, success: true }, { status: 201, headers: noStore });
}
