"use client";

import { useState } from "react";
import { Camera, CheckCircle2, MousePointerClick, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneFrame } from "@/features/landing/product-tour/phone-frame";
import type { SceneProps } from "@/features/landing/product-tour/product-tour";
import { ProofPhoto } from "@/features/landing/product-tour/proof-photo";
import { TourBubble, TourBubbles } from "@/features/landing/product-tour/tour-bubble";
import { TOUR_ORDER, TOUR_PROOF } from "@/features/landing/product-tour/tour-data";
import { useTypewriter } from "@/features/landing/product-tour/typing";
import {
  GESTURE_RESULT_DELAY_MS,
  useDelayedCall,
  useTimeline,
} from "@/features/landing/product-tour/use-timeline";

const INTRO_DURATIONS_MS = [500] as const;
const RECIPIENT = [TOUR_PROOF.recipient] as const;

const gestureButton =
  "flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none";

/** ⑤ App livreur : sur place, Karim photographie le colis, le nom du réceptionnaire se saisit, il valide. */
export function SceneProof({ onDone, reducedMotion }: SceneProps) {
  const intro = useTimeline(INTRO_DURATIONS_MS, reducedMotion);
  const [photoTaken, setPhotoTaken] = useState(false);
  const [validated, setValidated] = useState(false);
  const { typed, done: named } = useTypewriter(RECIPIENT, photoTaken, reducedMotion);
  const ready = intro >= INTRO_DURATIONS_MS.length;
  useDelayedCall(validated, GESTURE_RESULT_DELAY_MS, onDone);

  return (
    <div className="relative flex h-full items-center justify-center px-4 py-4">
      <PhoneFrame time="14:21">
        <div className="flex h-full flex-col px-3 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Livraison {TOUR_ORDER.number}</p>
            <span className="rounded-full bg-[#e6f8ee] px-1.5 py-0.5 text-[10px] font-semibold">Sur place</span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{TOUR_ORDER.dropoff}</p>

          <p className="mt-3 text-[11px] font-semibold">Preuve de livraison</p>
          <div className="mt-1.5 overflow-hidden rounded-xl border border-black/[0.08] bg-white">
            {photoTaken ? (
              <ProofPhoto className="product-tour-in block h-[104px] w-full" />
            ) : (
              <div className="flex h-[104px] flex-col items-center justify-center gap-1 border-2 border-dashed border-[#d5ddd6] text-muted-foreground">
                <Camera className="h-5 w-5" aria-hidden />
                <span className="text-[10px]">Photo du colis</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-2.5 py-2">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] text-muted-foreground">Remis à</p>
              <p className="flex min-h-4 items-center text-[11px] font-semibold">
                {typed[0] || <span className="font-normal text-muted-foreground/60">Nom du réceptionnaire</span>}
                {photoTaken && !named && <span className="product-tour-caret ml-px inline-block h-3 w-[1.5px] bg-[#0e1310]" aria-hidden />}
              </p>
            </div>
          </div>

          <div className="mt-auto pt-2">
            {validated ? (
              <p className="product-tour-in flex items-center justify-center gap-1.5 rounded-xl bg-[#e6f8ee] px-3 py-2.5 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4 text-[#00a854]" aria-hidden />
                Livraison validée · {TOUR_PROOF.time}
              </p>
            ) : photoTaken ? (
              <button
                type="button"
                data-tour-target
                disabled={!named}
                onClick={() => setValidated(true)}
                className={cn(gestureButton, named ? "product-tour-pulse" : "opacity-40")}
              >
                Valider la livraison
              </button>
            ) : (
              <button
                type="button"
                data-tour-target
                disabled={!ready}
                onClick={() => setPhotoTaken(true)}
                className={cn(gestureButton, ready ? "product-tour-pulse" : "opacity-40")}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
                Prendre la photo
              </button>
            )}
            <p
              className={cn(
                "mt-1.5 flex items-center justify-center gap-1 text-[10px] text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
                ready && !validated && (!photoTaken || named) ? "opacity-100" : "opacity-0"
              )}
              aria-hidden
            >
              <MousePointerClick className="h-3 w-3" />
              {photoTaken ? "Cliquez sur « Valider la livraison »" : "Cliquez sur « Prendre la photo »"}
            </p>
          </div>
        </div>
      </PhoneFrame>
      {photoTaken && (
        <TourBubbles className="left-6 top-8">
          <TourBubble className="relative">Preuve photo horodatée.</TourBubble>
          {named && (
            <TourBubble className="relative" delay={0.2}>
              Fini les litiges « pas reçu ».
            </TourBubble>
          )}
        </TourBubbles>
      )}
    </div>
  );
}
