"use client";

import { ClientPortalLayout } from "@/components/layouts/client-portal-layout";
import { PortalGuard } from "@/features/client-portal/portal-guard";
import { sora } from "./portal-font";

export default function ClientPortalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${sora.variable} [&_:is(h1,h2,h3)]:font-[family-name:var(--font-sora),var(--font-sans)]`}
      data-portal-root
    >
      <ClientPortalLayout>
        <PortalGuard>{children}</PortalGuard>
      </ClientPortalLayout>
    </div>
  );
}
