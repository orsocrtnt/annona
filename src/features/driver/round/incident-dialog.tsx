"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { STOP_INCIDENT_CODES, type StopIncidentCode } from "@/domains/round/round-rules";
import { preparePhoto } from "@/features/driver/round/driver-round-api";
import type { EffectiveStop } from "@/features/driver/round/effective-rounds";
import { fr } from "@/lib/i18n/fr";
import { nativeCameraAvailable, takeNativePhoto } from "@/lib/native/camera";
import { cn } from "@/lib/utils";

const t = fr.driverRound;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface IncidentDialogProps {
  stop: EffectiveStop | null;
  onClose: () => void;
  onSubmit: (input: { code: StopIncidentCode; comment: string; photo: Blob | null }) => Promise<void>;
}

/** LIV-05 : motif, commentaire et photo ; envoyé par la file hors réseau (LIV-06). */
export function IncidentDialog({ stop, onClose, onSubmit }: IncidentDialogProps) {
  const [code, setCode] = useState<StopIncidentCode>("ABSENT");
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const commentId = useId();

  useEffect(() => {
    if (!stop) {
      setCode("ABSENT");
      setComment("");
      setPhoto(null);
      setError(null);
    }
  }, [stop]);

  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function choose(file: File | undefined) {
    if (!file) return;
    const prepared = await preparePhoto(file);
    if (prepared.size > MAX_PHOTO_BYTES) {
      setError(t.photoTooLarge);
      return;
    }
    setError(null);
    setPhoto(prepared);
  }

  /** MOBILE-1 : appareil photo natif dans l'application ; champ fichier (`capture`) dans un navigateur. */
  async function pickPhoto() {
    if (!nativeCameraAvailable()) {
      fileRef.current?.click();
      return;
    }
    try {
      const file = await takeNativePhoto();
      if (file) await choose(file);
    } catch {
      setError(t.photoCameraUnavailable);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await onSubmit({ code, comment: comment.trim(), photo });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={stop !== null} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="max-h-[92dvh] max-w-sm overflow-y-auto" data-testid="driver-incident-dialog">
        <DialogHeader>
          <DialogTitle>{t.problemTitle}</DialogTitle>
          {stop ? <DialogDescription>{stop.merchantName}</DialogDescription> : null}
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t.problemReason}</legend>
          <div className="grid grid-cols-2 gap-2">
            {STOP_INCIDENT_CODES.map((value) => (
              <label
                key={value}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center rounded-xl border px-3 text-sm font-medium transition-colors",
                  code === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                )}
              >
                <input type="radio" name="incident-code" value={value} checked={code === value} onChange={() => setCode(value)} className="sr-only" />
                {fr.incidentCodes[value]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor={commentId}>{t.problemComment}</Label>
          <textarea
            id={commentId}
            value={comment}
            maxLength={500}
            rows={3}
            onChange={(event) => setComment(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-describedby={`${commentId}-hint`}
          />
          <p id={`${commentId}-hint`} className="text-xs text-muted-foreground">{t.problemCommentHint}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.problemPhoto}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            data-testid="driver-incident-photo"
            aria-label={t.problemPhotoAdd}
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), hors optimisation d'images */}
              <img src={preview} alt="" className="max-h-48 w-full rounded-xl object-cover" />
              <Button type="button" variant="outline" size="icon-sm" className="absolute right-2 top-2" onClick={() => setPhoto(null)} aria-label={t.problemPhotoRemove}>
                <X aria-hidden />
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="outline" size="touch" className="w-full" onClick={() => void pickPhoto()}>
            <Camera aria-hidden />
            {preview ? t.problemPhotoReplace : t.problemPhotoAdd}
          </Button>
          {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
        </div>
        <Button size="xl" className="w-full" onClick={() => void submit()} loading={busy} data-testid="driver-incident-send">
          {t.problemSend}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
