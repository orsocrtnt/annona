"use client";

import { DriverAppLayout } from "@/components/layouts/driver-app-layout";
import { DriverGuard } from "@/features/driver/driver-guard";
import { DriverLocationTracker } from "@/features/driver/driver-location-tracker";
import { DriverActionQueueProvider } from "@/features/driver/driver-action-queue-provider";
import { DriverActionQueueStatus } from "@/features/driver/driver-action-queue-status";

export default function DriverAppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverAppLayout>
      <DriverGuard>
        <DriverActionQueueProvider>
          <DriverLocationTracker />
          <DriverActionQueueStatus />
          {children}
        </DriverActionQueueProvider>
      </DriverGuard>
    </DriverAppLayout>
  );
}
