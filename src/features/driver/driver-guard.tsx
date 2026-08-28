"use client";

import { RoleGuard } from "@/components/auth/role-guard";

export function DriverGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="DRIVER" loginHref="/login/driver">
      {children}
    </RoleGuard>
  );
}
