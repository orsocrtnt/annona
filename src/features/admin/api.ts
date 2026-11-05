import type { PlatformCompanyPage } from "@/domains/admin/companies.service";
import type { PlatformCompanyFile } from "@/domains/admin/company-file.service";
import type { AdminSearchResult } from "@/domains/admin/search.service";
import type { PilotDetail, PilotList } from "@/domains/admin/pilots.service";
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
import type { WaitlistContactedFilter, WaitlistEntry, WaitlistPage } from "@/domains/growth/waitlist.service";
import type { FunnelPeriod, WaitlistFunnel } from "@/domains/growth/waitlist-funnel.service";
import type { AdminLastVisits } from "@/features/admin/contact-last-visit";

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

async function readAdminHome<T>(view: "full" | "badges", since: AdminLastVisits): Promise<T> {
  const params = new URLSearchParams();
  if (view === "badges") params.set("view", "badges");
  if (since.contact) params.set("contactSince", since.contact);
  if (since.waitlist) params.set("waitlistSince", since.waitlist);
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
export function fetchAdminHome(since: AdminLastVisits): Promise<AdminHome> {
  return readAdminHome<AdminHome>("full", since);
}

/** ADMIN-ESPACE : compteurs seuls, pour les pastilles du menu. */
export function fetchAdminHomeBadges(since: AdminLastVisits): Promise<AdminHomeBadges> {
  return readAdminHome<AdminHomeBadges>("badges", since);
}

/* ---------- Liste d'attente (ADMIN-ESPACE lot 2) ---------- */

export type WaitlistListFilters = {
  q?: string;
  contacted: WaitlistContactedFilter;
  page: number;
  pageSize: number;
};

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

/** Filtres de la liste et de l'export : mêmes paramètres, sans la pagination pour l'export. */
export function waitlistFilterParams(filters: Pick<WaitlistListFilters, "q" | "contacted">) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.contacted !== "all") params.set("contacted", filters.contacted);
  return params;
}

export async function fetchAdminWaitlist(filters: WaitlistListFilters): Promise<WaitlistPage> {
  const params = waitlistFilterParams(filters);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  const res = await fetch(`/api/admin/waitlist?${params.toString()}`, { cache: "no-store" });
  return readJson<WaitlistPage>(res);
}

export async function updateAdminWaitlistContacted(id: string, contacted: boolean): Promise<WaitlistEntry> {
  const res = await fetch(`/api/admin/waitlist/${encodeURIComponent(id)}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contacted }),
  });
  return readJson<WaitlistEntry>(res);
}

export async function fetchAdminWaitlistFunnel(days: FunnelPeriod): Promise<WaitlistFunnel> {
  const res = await fetch(`/api/admin/waitlist/funnel?days=${days}`, { cache: "no-store" });
  return readJson<WaitlistFunnel>(res);
}

/* ---------- Recherche globale (ADMIN-ESPACE lot 3) ---------- */

export async function fetchAdminSearch(q: string, signal?: AbortSignal): Promise<AdminSearchResult> {
  const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { cache: "no-store", signal });
  return readJson<AdminSearchResult>(res);
}

/* ---------- Pilotes accompagnés (ADMIN-ESPACE lot 4) ---------- */

/** Corps envoyé tel quel : le serveur valide (zod stricte) et répond par un message en français. */
export type PilotPayload = Record<string, string | null>;

export async function fetchAdminPilots(): Promise<PilotList> {
  const res = await fetch("/api/admin/pilots", { cache: "no-store" });
  return readJson<PilotList>(res);
}

export async function fetchAdminPilot(id: string): Promise<PilotDetail> {
  const res = await fetch(`/api/admin/pilots/${encodeURIComponent(id)}`, { cache: "no-store" });
  return readJson<PilotDetail>(res);
}

async function sendPilot(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ id: string }> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<{ id: string }>(res);
}

export function createAdminPilot(payload: PilotPayload) {
  return sendPilot("/api/admin/pilots", "POST", payload);
}

export function updateAdminPilot(id: string, payload: PilotPayload) {
  return sendPilot(`/api/admin/pilots/${encodeURIComponent(id)}`, "PATCH", payload);
}

export function addAdminPilotNote(id: string, body: string) {
  return sendPilot(`/api/admin/pilots/${encodeURIComponent(id)}/notes`, "POST", { body });
}
