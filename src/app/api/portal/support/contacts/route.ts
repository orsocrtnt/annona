import { NextResponse } from "next/server";
import { requireMerchantRole } from "@/lib/api/auth-guard";
import { getSupportContactsForClient } from "@/domains/client-portal/support-contacts.service";

export async function GET(request: Request) {
  const auth = await requireMerchantRole();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId") ?? undefined;

  const contacts = await getSupportContactsForClient(
    auth.context.user.id,
    auth.context.user.companyId,
    orderId
  );

  return NextResponse.json({ data: contacts, success: true });
}
