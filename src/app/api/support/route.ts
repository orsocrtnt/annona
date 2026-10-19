import { NextResponse } from "next/server";
import { getStaffTickets } from "@/domains/support/support.service";
import { requireSupportStaff } from "@/lib/api/support-staff-auth";
import { withApiHandler } from "@/lib/api/route-handler";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireSupportStaff();
    if ("error" in auth) return auth.error;
    const tickets = await getStaffTickets(auth.companyId);
    return NextResponse.json({ data: tickets, success: true });
  });
}
