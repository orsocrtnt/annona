import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { getSupportContactsForClient } from "@/domains/client-portal/support-contacts.service";

export async function GET(request: Request) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const deliveryId = searchParams.get("deliveryId") ?? undefined;

  const contacts = await getSupportContactsForClient(
    auth.context.user.id,
    auth.context.user.companyId,
    deliveryId
  );

  return NextResponse.json({ data: contacts, success: true });
}
