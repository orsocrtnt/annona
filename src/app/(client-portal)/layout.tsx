"use client";

import { ClientPortalLayout } from "@/components/layouts/client-portal-layout";
import { PortalGuard } from "@/features/client-portal/portal-guard";

export default function ClientPortalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientPortalLayout>
      <PortalGuard>{children}</PortalGuard>
    </ClientPortalLayout>
  );
}
