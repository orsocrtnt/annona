import type { NavItem } from "@/types";

/** Compteurs des pastilles du menu super-administrateur (voir `/api/admin/home?view=badges`). */
export type AdminNavCounts = {
  contactNew: number;
  waitlistNew: number;
  openIncidents: number;
  openSupportTickets: number;
};

export const ADMIN_BADGE_MAX = 99;

function badgeFor(count: number, label: (count: number) => string) {
  if (!Number.isFinite(count) || count <= 0) return {};
  return { badge: count > ADMIN_BADGE_MAX ? `${ADMIN_BADGE_MAX}+` : count, badgeLabel: label(count) };
}

/**
 * Pastilles de nouveautés : messages Contact et inscriptions à la liste d'attente arrivés depuis la dernière
 * visite de leur page, incidents ouverts et tickets support ouverts ou en cours. Aucune pastille à zéro.
 */
export function applyAdminNavBadges(items: NavItem[], counts: AdminNavCounts | null | undefined): NavItem[] {
  if (!counts) return items;
  const byHref: Record<string, { badge?: string | number; badgeLabel?: string }> = {
    "/admin/contact": badgeFor(counts.contactNew, (n) => `${n} ${n > 1 ? "nouveaux messages" : "nouveau message"}`),
    "/admin/waitlist": badgeFor(counts.waitlistNew, (n) => `${n} ${n > 1 ? "nouvelles inscriptions" : "nouvelle inscription"}`),
    "/admin/incidents": badgeFor(counts.openIncidents, (n) => `${n} ${n > 1 ? "incidents ouverts" : "incident ouvert"}`),
    "/admin/support": badgeFor(counts.openSupportTickets, (n) => `${n} ${n > 1 ? "tickets ouverts" : "ticket ouvert"}`),
  };
  return items.map((item) => {
    const extra = byHref[item.href];
    return extra && extra.badge !== undefined ? { ...item, ...extra } : item;
  });
}
