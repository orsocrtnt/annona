"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ACCESS_REFUSED_HINT,
  ACCESS_REFUSED_MESSAGE,
  ACCESS_REFUSED_PARAM,
} from "@/lib/permissions/access-refused";

/** Explique un renvoi vers l'accueil après l'ouverture d'une page réservée à un autre rôle. */
function AccessRefusedNoticeState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const refused = params.get(ACCESS_REFUSED_PARAM) === "1";

  useEffect(() => {
    if (!refused) return;
    toast.info(ACCESS_REFUSED_MESSAGE, { id: ACCESS_REFUSED_PARAM, description: ACCESS_REFUSED_HINT, duration: 8000 });
    const next = new URLSearchParams(params.toString());
    next.delete(ACCESS_REFUSED_PARAM);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [refused, params, pathname, router]);

  return null;
}

export function AccessRefusedNotice() {
  return <Suspense fallback={null}><AccessRefusedNoticeState /></Suspense>;
}
