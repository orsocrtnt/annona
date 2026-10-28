import { NextResponse } from "next/server";
import { getClientInvoiceIdentity, updateClientInvoiceIdentity } from "@/domains/invoice/facturx/facturx.service";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { clientInvoiceIdentitySchema } from "@/lib/validations/einvoicing";

type Params = { params: Promise<{ id: string }> };

/** Identité de facturation (raison sociale, SIREN, TVA, adresse) d'un client de l'entreprise. Administrateur seulement. */
export async function GET(_request: Request, { params }: Params) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:read");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

    const { id } = await params;
    const identity = await getClientInvoiceIdentity(companyId, id);
    if (identity === undefined) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    return NextResponse.json({ data: identity, success: true });
  });
}

export async function PUT(request: Request, { params }: Params) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

    const parsed = clientInvoiceIdentitySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
    }
    const { id } = await params;
    const saved = await updateClientInvoiceIdentity(companyId, id, parsed.data);
    if (!saved) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    return NextResponse.json({ data: saved, success: true });
  });
}
