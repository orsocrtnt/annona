import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { serveProofFile } from "@/domains/delivery/proof.service";

/** Preuve d'une livraison du client connecté : l'entreprise et le client viennent de la session, jamais de l'URL. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;
  const { id: customerId, companyId } = auth.context.user;
  if (!companyId) {
    return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  }

  const { id, kind } = await params;
  return serveProofFile(kind, { companyId, deliveryId: id, customerId });
}
