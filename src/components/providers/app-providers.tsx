"use client";

import "@/lib/zod-jitless";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "./session-provider";
import { DemoModeBar } from "@/features/demo/demo-mode-bar";
import { NavigationProgress } from "@/components/navigation/navigation-progress";
import { useMediaQuery } from "@/hooks/use-media-query";
import { OPERATIONAL_QUERY_DEFAULTS } from "@/lib/query/defaults";
import { ThemeSync } from "@/components/theme/theme-sync";
import { ScrollToTopOnNavigation } from "@/components/navigation/scroll-to-top-on-navigation";
import { SkipLink } from "@/components/accessibility/skip-link";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            ...OPERATIONAL_QUERY_DEFAULTS,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeSync />
        <SkipLink />
        <NavigationProgress />
        <ScrollToTopOnNavigation />
        <DemoModeBar />
        {children}
      </SessionProvider>
      <Toaster
        position={isMobile ? "bottom-center" : "top-right"}
        toastOptions={{
          classNames: {
            toast: "rounded-xl border border-border bg-card shadow-lg",
            title: "text-sm font-medium",
            description: "text-sm text-muted-foreground",
          },
        }}
      />
    </QueryClientProvider>
  );
}
