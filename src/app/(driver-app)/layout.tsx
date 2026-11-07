"use client";

import { DriverAppLayout } from "@/components/layouts/driver-app-layout";
import { DriverGuard } from "@/features/driver/driver-guard";

/**
 * Application livreur (TOUR-1) : tournée du jour, file hors réseau (`offline-action-queue.ts`) et partage
 * de position pendant la tournée seulement (`use-driver-live-position.ts`).
 */
export default function DriverAppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverAppLayout>
      <DriverGuard>{children}</DriverGuard>
    </DriverAppLayout>
  );
}
