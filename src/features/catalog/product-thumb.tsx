"use client";

import { useState } from "react";
import { Croissant } from "lucide-react";
import { productPhotoUrl } from "@/features/catalog/api";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  productId: string;
  photoVersion: string | null;
  className?: string;
}

/** Vignette d'un produit (photo privée servie par l'API, CLI-03) ; pictogramme sans photo. */
export function ProductThumb({ productId, photoVersion, className }: ProductThumbProps) {
  const [failed, setFailed] = useState(false);
  const src = productPhotoUrl(productId, photoVersion);
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted", className)}>
      {src && !failed ? (
        // Photo privée servie par l'API (cookie de session) : pas d'optimisation next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Croissant className="h-1/2 w-1/2 text-muted-foreground/60" aria-hidden />
      )}
    </span>
  );
}
