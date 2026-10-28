import type { UserWithRole } from "@/types";

export async function syncAuth() {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
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
