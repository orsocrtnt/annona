import { NextResponse } from "next/server";
import { requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { gatePlatformWrite } from "@/lib/api/platform-access";
import { setWaitlistContacted, waitlistContactedSchema } from "@/domains/growth/waitlist.service";

const noStore = { "Cache-Control": "no-store" };

/** ADMIN-ESPACE lot 2 : case « contacté » d'une inscription (date et auteur enregistrés). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffRole("dashboard:admin");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["SUPER_ADMIN"]);
  const blocked = await gatePlatformWrite(auth.context, denied, "CONTACT_MESSAGES", "PATCH");
  if (blocked) return blocked;

  const parsed = waitlistContactedSchema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success || !id || id.length > 64) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400, headers: noStore });
  }
  const result = await setWaitlistContacted(id, parsed.data.contacted, auth.context.user.id);
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Inscription introuvable" }, { status: 404, headers: noStore });
  }
  return NextResponse.json({ data: result.entry, success: true }, { headers: noStore });
}
