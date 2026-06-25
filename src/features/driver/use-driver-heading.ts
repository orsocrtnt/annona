"use client";

import { useEffect, useRef, useState } from "react";
import type { LivePosition } from "@/features/driver/use-driver-live-position";
import { computeBearing } from "@/lib/maps/navigation-guidance";
import { haversineMeters } from "@/lib/maps/navigation-utils";

export function useDriverHeading(position: LivePosition | null): number | null {
  const previousRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);

  useEffect(() => {
    if (!position) return;

    if (position.heading != null && position.heading >= 0) {
      setBearing(position.heading);
      previousRef.current = {
        latitude: position.latitude,
        longitude: position.longitude,
      };
      return;
    }

    const previous = previousRef.current;
    if (!previous) {
      previousRef.current = {
        latitude: position.latitude,
        longitude: position.longitude,
      };
      return;
    }

    const moved = haversineMeters(previous, position);
    if (moved >= 6) {
      setBearing(computeBearing(previous, position));
      previousRef.current = {
        latitude: position.latitude,
        longitude: position.longitude,
      };
    }
  }, [position]);

  return bearing;
}
