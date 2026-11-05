import type { NavItem } from "@/types";

export type NavSection = { title: string | null; items: NavItem[] };

/**
 * Regroupe les entrées consécutives d'un même `group` sous un titre de section.
 * Un menu sans groupe (entreprise, dispatcher, mini-admin, livreur) donne une seule section sans titre :
 * son rendu reste identique.
 */
export function groupNavItems(items: NavItem[]): NavSection[] {
  const sections: NavSection[] = [];
  for (const item of items) {
    const title = item.group ?? null;
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.items.push(item);
    else sections.push({ title, items: [item] });
  }
  return sections;
}
