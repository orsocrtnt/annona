"use client";

import { DriverAppLayout } from "@/components/layouts/driver-app-layout";
import { DriverGuard } from "@/features/driver/driver-guard";

/**
 * Application livreur. La tournée, la file hors réseau (`offline-action-queue.ts`) et le partage de
 * position pendant la tournée (`use-driver-live-position.ts`) seront branchés par TOUR-1.
 */
export default function DriverAppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverAppLayout>
      <DriverGuard>{children}</DriverGuard>
    </DriverAppLayout>
  );
}
