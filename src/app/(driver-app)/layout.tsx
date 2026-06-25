"use client";

import { DriverAppLayout } from "@/components/layouts/driver-app-layout";
import { DriverGuard } from "@/features/driver/driver-guard";
import { DriverLocationTracker } from "@/features/driver/driver-location-tracker";

export default function DriverAppRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverGuard>
      <DriverLocationTracker />
      <DriverAppLayout>{children}</DriverAppLayout>
    </DriverGuard>
  );
}
