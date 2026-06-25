import type { PendingCredentials } from "@/features/users/user-credentials-cell";

const STORAGE_KEY = "tutelliv:pending-credentials";

export type StoredPendingCredentials = PendingCredentials & {
  userId: string;
  savedAt: string;
};

export function loadPendingCredentials(): Record<string, PendingCredentials> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredPendingCredentials[];
    return Object.fromEntries(
      parsed.map(({ userId, email, password, role }) => [
        userId,
        { email, password, role },
      ])
    );
  } catch {
    return {};
  }
}

export function savePendingCredential(
  userId: string,
  credentials: PendingCredentials
): void {
  if (typeof window === "undefined") return;

  const existing = loadAllStored();
  const next = existing.filter((item) => item.userId !== userId);
  next.push({
    userId,
    ...credentials,
    savedAt: new Date().toISOString(),
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removePendingCredential(userId: string): void {
  if (typeof window === "undefined") return;

  const next = loadAllStored().filter((item) => item.userId !== userId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function loadAllStored(): StoredPendingCredentials[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredPendingCredentials[];
  } catch {
    return [];
  }
}
