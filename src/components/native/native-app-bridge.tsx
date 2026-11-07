"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startNativePush } from "@/lib/native/push";

/**
 * MOBILE-1 — branchements natifs communs aux espaces de l'application (client et livreur) :
 * notifications natives (autorisation, jeton, ouverture de la page touchée). Sans effet dans un navigateur.
 */
export function NativeAppBridge() {
  const router = useRouter();

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void startNativePush({ navigate: (path) => router.push(path) })
      .then((result) => {
        if (cancelled) result.stop();
        else stop = result.stop;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [router]);

  return null;
}
