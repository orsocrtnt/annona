import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getClientInvoices } from "@/domains/invoice/invoice.service";

export async function GET() {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const invoices = await getClientInvoices(auth.context.user.id);

  return NextResponse.json({ data: invoices, success: true });
}
