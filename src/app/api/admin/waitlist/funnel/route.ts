import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead } from "@/lib/api/platform-access";
import { parseFunnelParams, readWaitlistFunnel } from "@/domains/growth/waitlist-funnel.service";

/** ADMIN-ESPACE lot 2 : entonnoir de /tarifs (visites, clics, inscriptions) sur 7 ou 30 jours. */
export async function GET(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "CONTACT_MESSAGES");
  if (blocked) return blocked;

  const parsed = parseFunnelParams(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const data = await readWaitlistFunnel(parsed.query);
  return NextResponse.json({ data, success: true }, { headers: { "Cache-Control": "no-store" } });
}
