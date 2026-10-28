"use client";

import Image from "next/image";
import { POD_FAILURE_LABELS, type PodFailureCode } from "@/lib/pod/codes";

export function ProofOfDeliveryCard({
  status,
  photoUrl,
  failureCode,
  note,
  signatureUrl,
  pdfUrl,
  recipientName,
  signatureRefusedReason,
}: {
  status: string;
  photoUrl?: string | null;
  failureCode?: string | null;
  note?: string | null;
  /** Lien interne vers la signature (URL signée générée à la demande). */
  signatureUrl?: string | null;
  /** Lien interne vers le PDF de preuve horodaté. */
  pdfUrl?: string | null;
  recipientName?: string | null;
  signatureRefusedReason?: string | null;
}) {
  const failed = status === "FAILED";
  const hasProof = Boolean(photoUrl || failureCode || note || signatureUrl || recipientName);
  if (!hasProof && status !== "DELIVERED" && !failed) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">{failed ? "Échec de livraison" : "Preuve de livraison"}</p>
      {failureCode ? (
        <p className="text-sm text-muted-foreground">
          {POD_FAILURE_LABELS[failureCode as PodFailureCode] ?? failureCode}
        </p>
      ) : null}
      {note ? <p className="text-sm">{note}</p> : null}
      {recipientName ? <p className="text-sm">Reçu par {recipientName}</p> : null}
      {signatureRefusedReason ? (
        <p className="text-sm text-muted-foreground">Signature refusée : {signatureRefusedReason}</p>
      ) : null}
      {signatureUrl ? (
        <Image
          src={signatureUrl}
          alt={recipientName ? `Signature de ${recipientName}` : "Signature du réceptionnaire"}
          width={480}
          height={180}
          unoptimized
          className="max-h-32 w-auto rounded-md border border-border bg-white"
        />
      ) : null}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt="Preuve de livraison"
          width={960}
          height={720}
          unoptimized
          className="max-h-72 w-full rounded-md object-cover"
        />
      ) : failed ? null : (
        <p className="text-xs text-muted-foreground">Aucune photo jointe.</p>
      )}
      {pdfUrl ? (
        <a href={pdfUrl} download className="inline-block text-sm font-medium underline underline-offset-2">
          Télécharger la preuve (PDF)
        </a>
      ) : null}
    </div>
  );
}
