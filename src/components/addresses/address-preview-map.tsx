"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

const AddressPreviewMapInner = dynamic(
  () =>
    import("@/components/addresses/address-preview-map-inner").then(
      (module) => module.AddressPreviewMapInner
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Carte…
      </div>
    ),
  }
);

interface AddressPreviewMapProps {
  latitude: number;
  longitude: number;
  label?: string;
}

export function AddressPreviewMap({ latitude, longitude, label }: AddressPreviewMapProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
        <span>{label ?? "Position confirmée sur la carte"}</span>
      </div>
      <div className="h-44 w-full">
        <AddressPreviewMapInner latitude={latitude} longitude={longitude} />
      </div>
    </div>
  );
}
