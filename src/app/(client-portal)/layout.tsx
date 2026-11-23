"use client";

import { NativeAppBridge } from "@/components/native/native-app-bridge";
import { ClientPortalLayout } from "@/components/layouts/client-portal-layout";
import { PortalGuard } from "@/features/client-portal/portal-guard";
import { DemoBar } from "@/features/demo/demo-bar";

export default function ClientPortalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-portal-root>
      <DemoBar />
      <ClientPortalLayout>
        <PortalGuard>{children}</PortalGuard>
        <NativeAppBridge />
      </ClientPortalLayout>
    </div>
  );
}
