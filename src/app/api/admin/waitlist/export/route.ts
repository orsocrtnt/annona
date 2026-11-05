import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformRead } from "@/lib/api/platform-access";
import { exportWaitlistCsv, parseWaitlistExportParams, waitlistCsvFilename } from "@/domains/growth/waitlist.service";

/** ADMIN-ESPACE lot 2 : export CSV de la liste d'attente (UTF-8 avec BOM, « ; », pour Excel). */
export async function GET(request: Request) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformRead(auth.context, denied, "CONTACT_MESSAGES");
  if (blocked) return blocked;

  const parsed = parseWaitlistExportParams(new URL(request.url).searchParams);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await exportWaitlistCsv(parsed.query);
  return new NextResponse(result.csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${waitlistCsvFilename()}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Export-Truncated": result.truncated ? "1" : "0",
    },
  });
}
