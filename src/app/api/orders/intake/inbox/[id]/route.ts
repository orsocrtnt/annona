import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { closeInboundEmail } from "@/domains/order-intake/inbound-email.service";
import { intakeError, intakeJson, withIntakeErrors } from "../../intake-http";

const closeSchema = z.object({ status: z.enum(["CONVERTED", "DISMISSED"]), orderId: z.string().max(64).optional() }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);
    const parsed = closeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return intakeError("INVALID", "Action invalide", 400);
    const { id } = await params;
    const closed = await closeInboundEmail(companyId, id, parsed.data);
    if (!closed) return intakeError("NOT_FOUND", "E-mail introuvable.", 404);
    return intakeJson({ success: true });
  });
}
