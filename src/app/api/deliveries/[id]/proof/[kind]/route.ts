import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { serveProofFile } from "@/domains/delivery/proof.service";

/** Photo, signature (redirection vers une URL signée de 5 minutes) ou PDF de preuve, pour l'équipe de l'entreprise. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> }
) {
  const auth = await requireStaffRole("deliveries:read");
  if ("error" in auth) return auth.error;
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
  if (denied) return denied;

  const companyId = getCompanyId(auth.context);
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
  }

  const { id, kind } = await params;
  return serveProofFile(kind, { companyId, deliveryId: id });
}
