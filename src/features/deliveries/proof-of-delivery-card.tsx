"use client";

import Image from "next/image";
import { POD_FAILURE_LABELS, type PodFailureCode } from "@/lib/pod/codes";

export function ProofOfDeliveryCard({
  status,
  photoUrl,
  failureCode,
  note,
}: {
  status: string;
  photoUrl?: string | null;
  failureCode?: string | null;
  note?: string | null;
}) {
  const failed = status === "FAILED";
  const hasProof = Boolean(photoUrl || failureCode || note);
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
    </div>
  );
}
