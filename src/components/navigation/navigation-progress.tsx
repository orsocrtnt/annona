"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function NavigationProgressState() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const pending = pendingRoute !== null && pendingRoute === route;

  useEffect(() => { setPendingRoute(null); }, [route]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor?.href || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.search === window.location.search) return;
      setPendingRoute(route);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, route]);

  return (
    <div
      role="progressbar"
      aria-label="Navigation en cours"
      aria-hidden={!pending}
      data-navigation-pending={pending}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5 origin-left bg-brand transition-transform duration-150 ease-out",
        pending ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
      )}
    />
  );
}

export function NavigationProgress() {
  return <Suspense fallback={null}><NavigationProgressState /></Suspense>;
}
