import type { DashboardPeriodKey } from "@/lib/dashboard/dashboard-types";

export const DASHBOARD_WIDGET_TYPES = [
  "alerts-row",
  "alert-late",
  "alert-unassigned",
  "alert-assigned-not-started",
  "alert-in-progress",
  "today-summary",
  "today-delivered",
  "today-in-progress",
  "today-remaining",
  "today-late",
  "planning",
  "planning-categories",
  "planning-status-table",
  "stat-period-standard",
  "stat-period-courier",
  "stat-period-total",
  "stat-period-late",
  "stat-status-pending",
  "stat-status-assigned",
  "stat-status-purchasing",
  "stat-status-in-delivery",
  "stat-status-delivered",
  "stat-drivers-online",
  "history-7d",
  "map-drivers",
  "map-deliveries",
] as const;

export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

export interface DashboardWidgetConfig {
  period?: DashboardPeriodKey;
  mapHeight?: number;
}

export interface DashboardWidgetLayout {
  type: DashboardWidgetType;
  visible: boolean;
  order: number;
  config?: DashboardWidgetConfig;
}

export interface DashboardLayoutSettings {
  defaultPeriod: DashboardPeriodKey;
  widgets: DashboardWidgetLayout[];
}

export interface DashboardWidgetCatalogEntry {
  type: DashboardWidgetType;
  label: string;
  description: string;
  category: "alerts" | "today" | "planning" | "stats" | "maps";
  compact?: boolean;
}

export const DASHBOARD_WIDGET_CATALOG: DashboardWidgetCatalogEntry[] = [
  {
    type: "alerts-row",
    label: "Alertes opérationnelles",
    description: "Les 4 alertes en un bloc ; sans lui, « En retard » reste affiché",
    category: "alerts",
  },
  {
    type: "alert-late",
    label: "En retard",
    description: "Missions dont la date client est dépassée ; reste affiché si le bloc d'alertes est masqué",
    category: "alerts",
    compact: true,
  },
  {
    type: "alert-unassigned",
    label: "Sans livreur",
    description: "Missions en attente d'assignation",
    category: "alerts",
    compact: true,
  },
  {
    type: "alert-assigned-not-started",
    label: "Assignées non démarrées",
    description: "Assignées mais pas encore lancées",
    category: "alerts",
    compact: true,
  },
  {
    type: "alert-in-progress",
    label: "En cours de route",
    description: "Collecte ou livraison en cours",
    category: "alerts",
    compact: true,
  },
  {
    type: "today-summary",
    label: "Aujourd'hui — résumé",
    description: "Livrées, en cours, restantes, retard",
    category: "today",
  },
  {
    type: "today-delivered",
    label: "Aujourd'hui — livrées",
    description: "Missions terminées aujourd'hui",
    category: "today",
    compact: true,
  },
  {
    type: "today-in-progress",
    label: "Aujourd'hui — en cours",
    description: "Missions actives aujourd'hui",
    category: "today",
    compact: true,
  },
  {
    type: "today-remaining",
    label: "Aujourd'hui — restantes",
    description: "Missions prévues non terminées",
    category: "today",
    compact: true,
  },
  {
    type: "today-late",
    label: "Aujourd'hui — en retard",
    description: "Retard sur le planning du jour",
    category: "today",
    compact: true,
  },
  {
    type: "planning",
    label: "Planning complet",
    description: "Période, catégories et tableau par statut",
    category: "planning",
  },
  {
    type: "planning-categories",
    label: "Planning — catégories",
    description: "Commandes, courses et total sur la période",
    category: "planning",
  },
  {
    type: "planning-status-table",
    label: "Planning — tableau statuts",
    description: "Ventilation commandes / courses par statut",
    category: "planning",
  },
  {
    type: "stat-period-standard",
    label: "Commandes (période)",
    description: "Nombre de commandes sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-period-courier",
    label: "Courses (période)",
    description: "Nombre de courses sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-period-total",
    label: "Total missions (période)",
    description: "Toutes missions sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-period-late",
    label: "Retards (période)",
    description: "Missions en retard sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-status-pending",
    label: "Sans livreur (période)",
    description: "Statut en attente sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-status-assigned",
    label: "Assignées (période)",
    description: "Statut assigné sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-status-purchasing",
    label: "Achat / Collecté (période)",
    description: "Statut achat ou collecte sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-status-in-delivery",
    label: "En livraison (période)",
    description: "Statut livraison sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-status-delivered",
    label: "Livrées (période)",
    description: "Statut livré sur la période",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-drivers-online",
    label: "Livreurs connectés",
    description: "Nombre de livreurs en ligne maintenant",
    category: "stats",
    compact: true,
  },
  {
    type: "history-7d",
    label: "7 derniers jours",
    description: "Livrées par jour, dont en retard, et échecs",
    category: "stats",
  },
  // Une seule carte : « map-deliveries » reste un type connu pour lire les anciennes dispositions,
  // mais n'est plus proposé (normalizeDashboardLayout le fond dans « map-drivers »).
  {
    type: "map-drivers",
    label: "Carte en direct",
    description: "Livreurs et livraisons sur une seule carte : Tout, Livreurs ou Livraisons",
    category: "maps",
  },
];

export const COMPACT_DASHBOARD_WIDGETS = new Set(
  DASHBOARD_WIDGET_CATALOG.filter((entry) => entry.compact).map((entry) => entry.type)
);

export const DASHBOARD_WIDGET_CATEGORY_LABELS: Record<
  DashboardWidgetCatalogEntry["category"],
  string
> = {
  alerts: "Alertes",
  today: "Aujourd'hui",
  planning: "Planning",
  stats: "Statistiques",
  maps: "Cartes",
};

const DEFAULT_VISIBLE: DashboardWidgetType[] = ["alerts-row", "today-summary", "history-7d", "planning"];

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutSettings = {
  defaultPeriod: "7d",
  widgets: DASHBOARD_WIDGET_TYPES.map((type, index) => ({
    type,
    visible: DEFAULT_VISIBLE.includes(type),
    order: DEFAULT_VISIBLE.includes(type)
      ? DEFAULT_VISIBLE.indexOf(type)
      : 100 + index,
  })),
};

function assignWidgetOrdersFromSequence(
  visible: DashboardWidgetLayout[],
  hidden: DashboardWidgetLayout[]
) {
  return [
    ...visible.map((widget, index) => ({ ...widget, order: index })),
    ...hidden.map((widget, index) => ({ ...widget, order: visible.length + index })),
  ];
}

function assignWidgetOrders(widgets: DashboardWidgetLayout[]) {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  return assignWidgetOrdersFromSequence(
    sorted.filter((w) => w.visible),
    sorted.filter((w) => !w.visible)
  );
}

export function normalizeDashboardLayout(
  input?: Partial<DashboardLayoutSettings> | null
): DashboardLayoutSettings {
  const stored = input?.widgets ?? [];
  const byType = new Map(stored.map((widget) => [widget.type, widget]));

  const widgets = DASHBOARD_WIDGET_TYPES.map((type) => {
    const existing = byType.get(type);
    const fallback = DEFAULT_DASHBOARD_LAYOUT.widgets.find((w) => w.type === type)!;
    return {
      type,
      visible: existing?.visible ?? fallback.visible,
      order: existing?.order ?? fallback.order,
      config: existing?.config ?? fallback.config,
    };
  });

  return {
    defaultPeriod: input?.defaultPeriod ?? DEFAULT_DASHBOARD_LAYOUT.defaultPeriod,
    widgets: assignWidgetOrders(keepLateVisible(foldMapWidgets(widgets))),
  };
}

/** Les retards restent affichés en permanence (DEMO-3, tranche 9) : sans bloc d'alertes, « En retard » revient en tête. */
function keepLateVisible(widgets: DashboardWidgetLayout[]): DashboardWidgetLayout[] {
  if (widgets.some((w) => (w.type === "alerts-row" || w.type === "alert-late") && w.visible)) return widgets;
  return widgets.map((w) => (w.type === "alert-late" ? { ...w, visible: true, order: -1 } : w));
}

/**
 * Les anciennes dispositions pouvaient contenir deux blocs carte (livreurs, livraisons). Il n'en reste
 * qu'un, « map-drivers » : affiché si l'un des deux l'était, à la place du premier, avec sa hauteur.
 */
function foldMapWidgets(widgets: DashboardWidgetLayout[]): DashboardWidgetLayout[] {
  const drivers = widgets.find((w) => w.type === "map-drivers");
  const deliveries = widgets.find((w) => w.type === "map-deliveries");
  if (!drivers || !deliveries || !deliveries.visible) return widgets;
  const first = drivers.visible && drivers.order <= deliveries.order ? drivers : deliveries;
  return widgets.map((w) => {
    if (w.type === "map-deliveries") return { ...w, visible: false };
    if (w.type === "map-drivers") return { ...w, visible: true, order: first.order, config: first.config ?? w.config };
    return w;
  });
}

export function getVisibleDashboardWidgets(layout: DashboardLayoutSettings) {
  return [...layout.widgets].filter((w) => w.visible).sort((a, b) => a.order - b.order);
}

/**
 * Les anciennes dispositions pouvaient afficher deux cartes (livreurs puis missions). Les deux blocs
 * ouvrent maintenant la même carte unifiée : on n'en garde qu'une (la première dans l'ordre).
 */
export function mergeMapWidgets(widgets: DashboardWidgetLayout[]) {
  const seen = widgets.some((w) => w.type === "map-drivers" || w.type === "map-deliveries");
  if (!seen) return widgets;
  let kept = false;
  return widgets.filter((w) => {
    if (w.type !== "map-drivers" && w.type !== "map-deliveries") return true;
    if (kept) return false;
    kept = true;
    return true;
  });
}

export function groupDashboardWidgets(widgets: DashboardWidgetLayout[]) {
  const groups: { kind: "compact" | "full"; widgets: DashboardWidgetLayout[] }[] = [];

  for (const widget of widgets) {
    const isCompact = COMPACT_DASHBOARD_WIDGETS.has(widget.type);
    const last = groups[groups.length - 1];

    if (isCompact && last?.kind === "compact") {
      last.widgets.push(widget);
      continue;
    }

    groups.push({
      kind: isCompact ? "compact" : "full",
      widgets: [widget],
    });
  }

  return groups;
}

export function reorderDashboardWidgets(
  widgets: DashboardWidgetLayout[],
  type: DashboardWidgetType,
  direction: "up" | "down"
) {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const visible = sorted.filter((w) => w.visible);
  const index = visible.findIndex((w) => w.type === type);
  if (index < 0) return widgets;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= visible.length) return widgets;

  const nextVisible = [...visible];
  [nextVisible[index], nextVisible[swapIndex]] = [
    nextVisible[swapIndex]!,
    nextVisible[index]!,
  ];

  const hidden = sorted.filter((w) => !w.visible);
  return assignWidgetOrdersFromSequence(nextVisible, hidden);
}

export function moveDashboardWidgetToEdge(
  widgets: DashboardWidgetLayout[],
  type: DashboardWidgetType,
  edge: "first" | "last"
) {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const visible = sorted.filter((w) => w.visible);
  const index = visible.findIndex((w) => w.type === type);
  if (index < 0) return widgets;

  const nextVisible = [...visible];
  const [item] = nextVisible.splice(index, 1);
  if (!item) return widgets;

  if (edge === "first") nextVisible.unshift(item);
  else nextVisible.push(item);

  const hidden = sorted.filter((w) => !w.visible);
  return assignWidgetOrdersFromSequence(nextVisible, hidden);
}

export function toggleDashboardWidget(
  widgets: DashboardWidgetLayout[],
  type: DashboardWidgetType,
  visible: boolean
) {
  const next = widgets.map((widget) =>
    widget.type === type ? { ...widget, visible } : widget
  );
  return assignWidgetOrders(keepLateVisible(next));
}

export function getWidgetCatalogEntry(type: DashboardWidgetType) {
  return DASHBOARD_WIDGET_CATALOG.find((entry) => entry.type === type);
}
