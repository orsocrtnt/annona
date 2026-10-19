"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { POD_FAILURE_CODES, POD_FAILURE_LABELS, type PodFailureCode } from "@/lib/pod/codes";

export type PodDialogValue = {
  outcome: "SUCCESS" | "FAILED";
  photo: Blob | null;
  failureCode?: PodFailureCode;
  note?: string;
};

interface ProofOfDeliveryDialogProps {
  open: boolean;
  outcome: "SUCCESS" | "FAILED";
  loading?: boolean;
  feedbackMessage?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (value: PodDialogValue) => void;
}

async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("COMPRESSION"))),
        "image/jpeg",
        0.72
      );
    });
  } catch {
    return file;
  }
}

export function ProofOfDeliveryDialog({
  open,
  outcome,
  loading,
  feedbackMessage,
  onOpenChange,
  onConfirm,
}: ProofOfDeliveryDialogProps) {
  const titleId = useId();
  const failureCodeId = useId();
  const noteId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [failureCode, setFailureCode] = useState<PodFailureCode>("ABSENT");
  const [note, setNote] = useState("");

  const success = outcome === "SUCCESS";

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const compressed = await compressImage(file);
    setPhoto(compressed);
    setPreview(URL.createObjectURL(compressed));
  };

  const handleConfirm = () => {
    if (success && !photo) return;
    onConfirm({
      outcome,
      photo,
      failureCode: success ? undefined : failureCode,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        if (!next) {
          setPreview(null);
          setPhoto(null);
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        aria-labelledby={titleId}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle id={titleId}>
            {success ? "Preuve de livraison" : "Échec de livraison"}
          </DialogTitle>
          <DialogDescription>
            {success
              ? "Prenez une photo du colis remis (porte, destinataire, ou reçu)."
              : "Indiquez pourquoi la livraison n’a pas pu être faite. Une photo est facultative."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!success ? (
            <label htmlFor={failureCodeId} className="block space-y-1 text-sm">
              <span className="font-medium">Motif</span>
              <select
                id={failureCodeId}
                value={failureCode}
                onChange={(e) => setFailureCode(e.target.value as PodFailureCode)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {POD_FAILURE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {POD_FAILURE_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground hover:bg-muted/40"
          >
              {preview ? (
                <Image
                  src={preview}
                  alt="Preuve"
                  width={320}
                  height={192}
                  unoptimized
                  className="max-h-48 rounded-md object-cover"
                />
              ) : (
              <>
                <Camera className="h-6 w-6" />
                {success ? "Prendre la photo" : "Ajouter une photo (optionnel)"}
              </>
            )}
          </button>

          <label htmlFor={noteId} className="block space-y-1 text-sm">
            <span className="font-medium">Note</span>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={400}
              rows={2}
              placeholder="Commentaire (optionnel)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        {feedbackMessage && <p role={loading ? "status" : "alert"} aria-live="polite" className="text-sm text-muted-foreground">{feedbackMessage}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant={success ? "brand" : "destructive"}
            onClick={handleConfirm}
            loading={loading}
            disabled={success && !photo}
          >
            {success ? "Valider la livraison" : "Enregistrer l’échec"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
