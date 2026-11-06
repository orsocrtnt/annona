"use client";

import { RoleGuard } from "@/components/auth/role-guard";

export function PortalGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="MERCHANT" loginHref="/login/client">
      {children}
    </RoleGuard>
  );
}
