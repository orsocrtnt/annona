import type { PlatformCompanyPage } from "@/domains/admin/companies.service";
import type { PlatformCompanyFile } from "@/domains/admin/company-file.service";
import type { AdminSearchResult } from "@/domains/admin/search.service";
import type { PlatformUserPage } from "@/domains/admin/users.service";
import type { PlatformServiceHealth } from "@/domains/admin/service-health.service";
import type { OperationJobPage } from "@/domains/admin/operation-jobs.service";
import type { PlatformSupportTicketPage } from "@/domains/admin/support-tickets.service";
import type { PlatformOverview } from "@/domains/admin/platform.service";
import type { AdminHome, AdminHomeBadges } from "@/domains/admin/admin-home.service";

export async function fetchAdminOverview(): Promise<PlatformOverview> {
  const res = await fetch("/api/admin/overview", { cache: "no-store" });
  let json: { error?: string; data?: PlatformOverview } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformOverview;
}

export type SupportTicketListFilters = {
  q?: string;
  status?: string;
  priority?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminSupportTickets(
  filters: SupportTicketListFilters
): Promise<PlatformSupportTicketPage> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  const res = await fetch(`/api/admin/support-tickets?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformSupportTicketPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformSupportTicketPage;
}

export type OperationJobListFilters = {
  q?: string;
  status?: string;
  type?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminOperationJobs(filters: OperationJobListFilters): Promise<OperationJobPage> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const res = await fetch(`/api/admin/operation-jobs?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: OperationJobPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as OperationJobPage;
}

export type PlatformUserListFilters = {
  q?: string;
  role?: string;
  status?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminUsers(filters: PlatformUserListFilters): Promise<PlatformUserPage> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformUserPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformUserPage;
}

export type CompanyListFilters = {
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminCompanies(filters: CompanyListFilters): Promise<PlatformCompanyPage> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const res = await fetch(`/api/admin/companies?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformCompanyPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformCompanyPage;
}

export async function fetchAdminCompany(id: string): Promise<PlatformCompanyFile> {
  const res = await fetch(`/api/admin/companies/${id}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformCompanyFile } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (res.status === 404) throw new Error("Entreprise introuvable");
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformCompanyFile;
}

export async function fetchAdminServiceHealth(): Promise<PlatformServiceHealth> {
  const res = await fetch("/api/admin/service-health", { cache: "no-store" });
  let json: { error?: string; data?: PlatformServiceHealth } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformServiceHealth;
}

async function readAdminHome<T>(view: "full" | "badges"): Promise<T> {
  const query = view === "badges" ? "?view=badges" : "";
  const res = await fetch(`/api/admin/home${query}`, { cache: "no-store" });
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

/** ADMIN-ESPACE : accueil complet (« À traiter », chiffres clés, courbe, santé). */
export function fetchAdminHome(): Promise<AdminHome> {
  return readAdminHome<AdminHome>("full");
}

/** ADMIN-ESPACE : compteurs seuls, pour les pastilles du menu. */
export function fetchAdminHomeBadges(): Promise<AdminHomeBadges> {
  return readAdminHome<AdminHomeBadges>("badges");
}

async function readJson<T>(res: Response): Promise<T> {
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

export async function fetchAdminSearch(q: string, signal?: AbortSignal): Promise<AdminSearchResult> {
  const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal });
  return readJson<AdminSearchResult>(res);
}
