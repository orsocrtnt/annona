"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Largeur d'export : la signature reste légère (hors ligne) tout en restant lisible sur le PDF. */
const EXPORT_WIDTH = 800;
/** Un tracé trop court (point isolé, effleurement) n'est pas une signature. */
const MIN_STROKE_POINTS = 8;

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
  const [hasInk, setHasInk] = useState(false);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  const position = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
    if (!canvas || pointsRef.current < MIN_STROKE_POINTS) {
      onChange(null);
      return;
    }
    const scale = Math.min(1, EXPORT_WIDTH / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(canvas.width * scale));
    out.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = out.getContext("2d");
    if (!ctx) {
      onChange(null);
      return;
    }
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    out.toBlob((blob) => onChange(blob), "image/png");
  }, [onChange]);

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (pointsRef.current >= MIN_STROKE_POINTS) setHasInk(true);
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
    onChange(null);
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
        className="h-36 w-full touch-none rounded-lg border border-dashed border-border bg-white"
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
