import type { NavItem } from "@/types";

/** Compteurs des pastilles du menu super-administrateur (voir `/api/admin/home?view=badges`). */
export type AdminNavCounts = {
  openSupportTickets: number;
};

export const ADMIN_BADGE_MAX = 99;

function badgeFor(count: number, label: (count: number) => string) {
  if (!Number.isFinite(count) || count <= 0) return {};
  return { badge: count > ADMIN_BADGE_MAX ? `${ADMIN_BADGE_MAX}+` : count, badgeLabel: label(count) };
}

/**
 * RETOURS-3 : pastille rouge du gérant sur « Support » quand une demande n'a pas encore été prise en charge.
 * Aucune pastille à zéro.
 */
export function applyCompanyNavBadges(items: NavItem[], counts: { openTickets: number } | null | undefined): NavItem[] {
  if (!counts) return items;
  const extra = badgeFor(counts.openTickets, (n) => `${n} ${n > 1 ? "nouvelles demandes" : "nouvelle demande"} de support`);
  if (extra.badge === undefined) return items;
  return items.map((item) => (item.href === "/support" ? { ...item, ...extra, badgeTone: "alert" as const } : item));
}

/** Pastille des tickets support ouverts ou en cours. Aucune pastille à zéro. */
export function applyAdminNavBadges(items: NavItem[], counts: AdminNavCounts | null | undefined): NavItem[] {
  if (!counts) return items;
  const byHref: Record<string, { badge?: string | number; badgeLabel?: string }> = {
    "/admin/support": badgeFor(counts.openSupportTickets, (n) => `${n} ${n > 1 ? "tickets ouverts" : "ticket ouvert"}`),
  };
  return items.map((item) => {
    const extra = byHref[item.href];
    return extra && extra.badge !== undefined ? { ...item, ...extra } : item;
  });
}
