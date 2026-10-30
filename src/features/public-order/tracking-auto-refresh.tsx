"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Relit la page toutes les 30 secondes tant qu'elle est visible. */
export function TrackingAutoRefresh() {
  const router = useRouter();
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
