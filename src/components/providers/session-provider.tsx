"use client";

import { useSession } from "@/hooks/use-session";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useSession();
  return <>{children}</>;
}
