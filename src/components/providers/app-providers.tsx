"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "./session-provider";
import { DemoModeBar } from "@/features/demo/demo-mode-bar";
import { NavigationProgress } from "@/components/navigation/navigation-progress";
import { useMediaQuery } from "@/hooks/use-media-query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <NavigationProgress />
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
