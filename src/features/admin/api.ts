import type { PlatformOverview } from "@/domains/admin/platform.service";

export async function fetchAdminOverview(): Promise<PlatformOverview> {
  const res = await fetch("/api/admin/overview");
  let json: { error?: string; data?: PlatformOverview } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformOverview;
}
