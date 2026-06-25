import type { UserWithRole } from "@/types";

export async function syncAuth(accountType?: "company") {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(accountType ? { accountType } : {}),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "Synchronisation échouée");
  }
  return json as {
    user: UserWithRole;
    permissions: string[];
    redirectTo: string;
  };
}
