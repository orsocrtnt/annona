import { NextResponse } from "next/server";
import { prisma } from "@/services/prisma/client";
import { getPodPhotoSignedUrl } from "@/lib/storage/pod";
import { getPodSignatureSignedUrl } from "@/lib/storage/pod-signature";

export const PROOF_FILE_KINDS = ["photo", "signature"] as const;
export type ProofFileKind = (typeof PROOF_FILE_KINDS)[number];

/**
 * Portée d'accès à une preuve. `companyId` vient toujours de la session ; `customerId` est renseigné
 * pour le portail client (le client ne voit que ses propres livraisons).
 */
export type ProofScope = { companyId: string; deliveryId: string; customerId?: string };

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Sert une pièce de preuve après contrôle de l'entreprise (et du client pour le portail). */
export async function serveProofFile(kind: string, scope: ProofScope): Promise<Response> {
  if (!(PROOF_FILE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404, headers: NO_STORE });
  }
  const notFound = () => NextResponse.json({ error: "Document introuvable" }, { status: 404, headers: NO_STORE });

  const delivery = await prisma.delivery.findFirst({
    where: {
      id: scope.deliveryId,
      companyId: scope.companyId,
      ...(scope.customerId ? { customerId: scope.customerId } : {}),
    },
    select: { podPhotoPath: true, podSignaturePath: true },
  });
  if (!delivery) return notFound();
  const url =
    kind === "photo"
      ? await getPodPhotoSignedUrl(delivery.podPhotoPath, scope.companyId, scope.deliveryId)
      : await getPodSignatureSignedUrl(delivery.podSignaturePath, scope.companyId, scope.deliveryId);
  if (!url) return notFound();
  return NextResponse.redirect(url, { status: 307, headers: NO_STORE });
}
