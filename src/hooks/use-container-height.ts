"use client";

import { useEffect, useState, type RefObject } from "react";

/** Mesure la hauteur réelle du conteneur — fiable pour Leaflet */
export function useContainerHeight(ref: RefObject<HTMLElement | null>, fallback = 700) {
  const [height, setHeight] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setHeight(h);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return height;
}
