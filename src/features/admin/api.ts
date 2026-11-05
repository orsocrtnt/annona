import type { PlatformCompanyDetail, PlatformCompanyPage } from "@/domains/admin/companies.service";
import type { PlatformUserPage } from "@/domains/admin/users.service";
import type { PlatformIncidentPage } from "@/domains/admin/incidents.service";
import type { PlatformServiceHealth } from "@/domains/admin/service-health.service";
import type { OperationJobPage } from "@/domains/admin/operation-jobs.service";
import type { PlatformSupportTicketPage } from "@/domains/admin/support-tickets.service";
import type { CommercialSubscriptionPage } from "@/domains/admin/subscriptions.service";
import type { PlatformAccessEventPage } from "@/domains/admin/platform-access.service";
import type { PlatformOverview } from "@/domains/admin/platform.service";
import type { SaasHealthIndicators } from "@/domains/admin/saas-health.service";
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

export async function fetchAdminSaasHealth(): Promise<SaasHealthIndicators> {
  const res = await fetch("/api/admin/saas-health", { cache: "no-store" });
  let json: { error?: string; data?: SaasHealthIndicators } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as SaasHealthIndicators;
}

export type SubscriptionListFilters = {
  q?: string;
  status?: string;
  plan?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminSubscriptions(
  filters: SubscriptionListFilters
): Promise<CommercialSubscriptionPage> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.plan) params.set("plan", filters.plan);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  const res = await fetch(`/api/admin/subscriptions?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: CommercialSubscriptionPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as CommercialSubscriptionPage;
}

export type SupportTicketListFilters = {
  q?: string;
  status?: string;
  priority?: string;
  page: number;
  pageSize: number;
};

export type PlatformAccessListFilters = {
  resource?: string;
  decision?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminAccessEvents(filters: PlatformAccessListFilters): Promise<PlatformAccessEventPage> {
  const params = new URLSearchParams();
  if (filters.resource) params.set("resource", filters.resource);
  if (filters.decision) params.set("decision", filters.decision);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const res = await fetch(`/api/admin/access-events?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformAccessEventPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformAccessEventPage;
}

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

export async function fetchAdminCompany(id: string): Promise<PlatformCompanyDetail> {
  const res = await fetch(`/api/admin/companies/${id}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformCompanyDetail } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (res.status === 404) throw new Error("Entreprise introuvable");
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformCompanyDetail;
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

export type IncidentListFilters = {
  q?: string;
  visibility?: string;
  page: number;
  pageSize: number;
};

export async function fetchAdminIncidents(filters: IncidentListFilters): Promise<PlatformIncidentPage> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.visibility) params.set("visibility", filters.visibility);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const res = await fetch(`/api/admin/incidents?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: PlatformIncidentPage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as PlatformIncidentPage;
}

async function readAdminHome<T>(view: "full" | "badges", contactSince: string | null): Promise<T> {
  const params = new URLSearchParams();
  if (view === "badges") params.set("view", "badges");
  if (contactSince) params.set("contactSince", contactSince);
  const query = params.size > 0 ? `?${params.toString()}` : "";
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
export function fetchAdminHome(contactSince: string | null): Promise<AdminHome> {
  return readAdminHome<AdminHome>("full", contactSince);
}

/** ADMIN-ESPACE : compteurs seuls, pour les pastilles du menu. */
export function fetchAdminHomeBadges(contactSince: string | null): Promise<AdminHomeBadges> {
  return readAdminHome<AdminHomeBadges>("badges", contactSince);
}
