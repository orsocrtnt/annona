import { NextResponse } from "next/server";
import { prisma } from "@/services/prisma/client";
import { readCompanyLogo } from "@/domains/company/company-logo.service";
import { buildProofPdf } from "@/lib/pdf/proof-pdf";
import { POD_FAILURE_LABELS, type PodFailureCode } from "@/lib/pod/codes";
import { downloadPodPhoto, getPodPhotoSignedUrl } from "@/lib/storage/pod";
import { downloadPodSignature, getPodSignatureSignedUrl } from "@/lib/storage/pod-signature";

export const PROOF_FILE_KINDS = ["photo", "signature", "pdf"] as const;
export type ProofFileKind = (typeof PROOF_FILE_KINDS)[number];

/**
 * Portée d'accès à une preuve. `companyId` vient toujours de la session ; `customerId` est renseigné
 * pour le portail client (le client ne voit que ses propres livraisons).
 */
export type ProofScope = { companyId: string; deliveryId: string; customerId?: string };

function personName(person: { firstName?: string | null; lastName?: string | null } | null | undefined) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim() || null;
}

function addressLine(address: string | null, postalCode: string | null, city: string | null) {
  return [address, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

async function loadProofDelivery(scope: ProofScope) {
  return prisma.delivery.findFirst({
    where: {
      id: scope.deliveryId,
      companyId: scope.companyId,
      ...(scope.customerId ? { customerId: scope.customerId } : {}),
    },
    select: {
      id: true,
      reference: true,
      companyId: true,
      address: true,
      city: true,
      postalCode: true,
      pickupAddress: true,
      pickupCity: true,
      pickupPostalCode: true,
      driverName: true,
      missionStartedAt: true,
      completedAt: true,
      podOutcome: true,
      podPhotoPath: true,
      podFailureCode: true,
      podNote: true,
      podCapturedAt: true,
      podSignaturePath: true,
      podRecipientName: true,
      podSignatureRefusedReason: true,
      podLatitude: true,
      podLongitude: true,
      podPositionAt: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
      order: { select: { reference: true, customerEmail: true } },
      company: { select: { name: true } },
      driver: { select: { firstName: true, lastName: true } },
    },
  });
}

export async function buildDeliveryProofPdf(scope: ProofScope): Promise<{ bytes: Uint8Array; reference: string } | null> {
  const delivery = await loadProofDelivery(scope);
  if (!delivery?.podOutcome) return null;
  const [photo, signature, logo] = await Promise.all([
    downloadPodPhoto(delivery.podPhotoPath, delivery.companyId, delivery.id).catch(() => null),
    downloadPodSignature(delivery.podSignaturePath, delivery.companyId, delivery.id).catch(() => null),
    readCompanyLogo(delivery.companyId).catch(() => null),
  ]);
  const failed = delivery.podOutcome === "FAILED";
  const bytes = await buildProofPdf({
    deliveryId: delivery.id,
    reference: delivery.reference,
    outcome: failed ? "FAILED" : "DELIVERED",
    companyName: delivery.company.name,
    companyLogoPng: logo,
    orderReference: delivery.order.reference,
    customerName: personName(delivery.customer),
    customerEmail: delivery.customer?.email ?? delivery.order.customerEmail,
    pickupAddress: delivery.pickupAddress
      ? addressLine(delivery.pickupAddress, delivery.pickupPostalCode, delivery.pickupCity)
      : null,
    deliveryAddress: addressLine(delivery.address, delivery.postalCode, delivery.city),
    driverName: delivery.driverName ?? personName(delivery.driver),
    pickedUpAt: delivery.missionStartedAt,
    completedAt: delivery.podCapturedAt ?? delivery.completedAt,
    position:
      delivery.podLatitude != null && delivery.podLongitude != null
        ? { latitude: delivery.podLatitude, longitude: delivery.podLongitude, at: delivery.podPositionAt }
        : null,
    recipientName: delivery.podRecipientName,
    signaturePng: signature,
    signatureRefusedReason: delivery.podSignatureRefusedReason,
    failureLabel: delivery.podFailureCode
      ? POD_FAILURE_LABELS[delivery.podFailureCode as PodFailureCode] ?? delivery.podFailureCode
      : null,
    note: delivery.podNote,
    photo,
    generatedAt: new Date(),
  });
  return { bytes, reference: delivery.reference };
}

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Sert une pièce de preuve après contrôle de l'entreprise (et du client pour le portail). */
export async function serveProofFile(kind: string, scope: ProofScope): Promise<Response> {
  if (!(PROOF_FILE_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404, headers: NO_STORE });
  }
  const notFound = () => NextResponse.json({ error: "Document introuvable" }, { status: 404, headers: NO_STORE });

  if (kind === "pdf") {
    const pdf = await buildDeliveryProofPdf(scope);
    if (!pdf) return notFound();
    const filename = `preuve-${pdf.reference.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    return new Response(Buffer.from(pdf.bytes), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

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
