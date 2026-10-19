"use client";

import { useEffect } from "react";
import { clearPendingCredentials } from "@/lib/storage/pending-credentials";
import { useSession } from "@/hooks/use-session";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useSession();
  useEffect(() => { clearPendingCredentials(); }, []);
  return <>{children}</>;
}
