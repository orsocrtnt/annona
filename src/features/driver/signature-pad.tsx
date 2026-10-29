"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  canvasBackingSize,
  exportSize,
  isSignatureExportable,
  pointerToCanvas,
} from "./signature-geometry";

/** Largeur d'export : la signature reste légère (hors ligne) tout en restant lisible sur le PDF. */
const EXPORT_WIDTH = 800;

export type SignaturePadValue = Blob | null;

interface SignaturePadProps {
  disabled?: boolean;
  onChange: (value: SignaturePadValue) => void;
}

export function SignaturePad({ disabled, onChange }: SignaturePadProps) {
  const labelId = useId();
  const hintId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** (Re)dimensionne le canevas sur sa taille de mise en page ; redessiner est impossible, la signature est donc remise à zéro. */
  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // clientWidth/clientHeight ignorent les transformations d'animation du dialogue (contrairement à getBoundingClientRect).
    const size = canvasBackingSize({ width: canvas.clientWidth, height: canvas.clientHeight }, window.devicePixelRatio);
    if (!size) return;
    if (canvas.width === size.width && canvas.height === size.height) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(size.width / canvas.clientWidth, 0, 0, size.height / canvas.clientHeight, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111111";
    }
    if (pointsRef.current > 0) {
      pointsRef.current = 0;
      setHasInk(false);
      onChangeRef.current(null);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setup();
    const observer = new ResizeObserver(() => setup());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [setup]);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    return pointerToCanvas(
      canvas.getBoundingClientRect(),
      { width: canvas.clientWidth, height: canvas.clientHeight },
      event.clientX,
      event.clientY
    );
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = position(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    pointsRef.current += 1;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = position(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    pointsRef.current += 1;
  };

  const exportBlob = useCallback(() => {
    const canvas = canvasRef.current;
    const target = canvas ? exportSize({ width: canvas.width, height: canvas.height }, EXPORT_WIDTH) : null;
    if (
      !canvas ||
      !target ||
      !isSignatureExportable({ points: pointsRef.current, width: target.width, height: target.height })
    ) {
      onChangeRef.current(null);
      return;
    }
    const out = document.createElement("canvas");
    out.width = target.width;
    out.height = target.height;
    const ctx = out.getContext("2d");
    if (!ctx) {
      onChangeRef.current(null);
      return;
    }
    ctx.drawImage(canvas, 0, 0, target.width, target.height);
    out.toBlob((blob) => onChangeRef.current(blob), "image/png");
  }, []);

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    const target = canvas ? exportSize({ width: canvas.width, height: canvas.height }, EXPORT_WIDTH) : null;
    const exportable = Boolean(
      target && isSignatureExportable({ points: pointsRef.current, width: target.width, height: target.height })
    );
    setHasInk(exportable);
    exportBlob();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    pointsRef.current = 0;
    setHasInk(false);
    onChangeRef.current(null);
  };

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">Signature du réceptionnaire</p>
      <canvas
        ref={canvasRef}
        role="img"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        className="h-36 w-full touch-none rounded-lg border border-dashed border-border bg-white dark:bg-white"
        data-testid="signature-canvas"
        data-signed={hasInk ? "true" : "false"}
      />
      <div className="flex items-center justify-between gap-2">
        <p id={hintId} className="text-xs text-muted-foreground">
          {hasInk
            ? "Signature enregistrée. Effacez pour recommencer."
            : "Faites signer du doigt dans le cadre. Si la personne ne peut ou ne veut pas signer, indiquez-le ci-dessous."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={disabled || !hasInk}>
          <Eraser className="mr-1 h-4 w-4" aria-hidden="true" />
          Effacer
        </Button>
      </div>
    </div>
  );
}
