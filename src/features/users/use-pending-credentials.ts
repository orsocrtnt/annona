"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadPendingCredentials,
  removePendingCredential,
  savePendingCredential,
} from "@/lib/storage/pending-credentials";
import type { PendingCredentials } from "./user-credentials-cell";

export function usePendingCredentials() {
  const [credentials, setCredentials] = useState<Record<string, PendingCredentials>>({});

  useEffect(() => {
    setCredentials(loadPendingCredentials());
  }, []);

  const addCredentials = useCallback((userId: string, data: PendingCredentials) => {
    savePendingCredential(userId, data);
    setCredentials((prev) => ({ ...prev, [userId]: data }));
  }, []);

  const dismissCredentials = useCallback((userId: string) => {
    removePendingCredential(userId);
    setCredentials((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  return { credentials, addCredentials, dismissCredentials };
}
