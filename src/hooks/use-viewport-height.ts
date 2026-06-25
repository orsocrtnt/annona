"use client";

import { useEffect, useState } from "react";

/** Hauteur viewport en pixels — Leaflet exige une valeur numérique explicite */
export function useViewportHeight(fallback = 700) {
  const [height, setHeight] = useState(fallback);

  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return height;
}
