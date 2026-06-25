export const PORTAL_DASHBOARD_WIDGET_TYPES = [
  "stats-row",
  "stat-active-orders",
  "stat-in-delivery",
  "stat-delivered-month",
  "stat-next-delivery",
  "chart-orders-history",
  "chart-deliveries-status",
  "recent-deliveries",
  "quick-actions",
  "orders-footnote",
] as const;

export type PortalDashboardWidgetType = (typeof PORTAL_DASHBOARD_WIDGET_TYPES)[number];

export interface PortalDashboardWidgetLayout {
  type: PortalDashboardWidgetType;
  visible: boolean;
  order: number;
}

export interface PortalDashboardLayoutSettings {
  widgets: PortalDashboardWidgetLayout[];
}

export interface PortalDashboardWidgetCatalogEntry {
  type: PortalDashboardWidgetType;
  label: string;
  description: string;
  category: "stats" | "charts" | "activity" | "shortcuts";
  compact?: boolean;
}

export const PORTAL_DASHBOARD_WIDGET_CATALOG: PortalDashboardWidgetCatalogEntry[] = [
  {
    type: "stats-row",
    label: "Indicateurs — vue d'ensemble",
    description: "Les 4 indicateurs en un bloc",
    category: "stats",
  },
  {
    type: "stat-active-orders",
    label: "Commandes actives",
    description: "Commandes en cours de traitement",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-in-delivery",
    label: "En livraison",
    description: "Livraisons actuellement en route",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-delivered-month",
    label: "Livrées ce mois",
    description: "Commandes livrées ce mois-ci",
    category: "stats",
    compact: true,
  },
  {
    type: "stat-next-delivery",
    label: "Prochaine livraison",
    description: "Heure estimée de la prochaine livraison",
    category: "stats",
    compact: true,
  },
  {
    type: "chart-orders-history",
    label: "Historique des commandes",
    description: "Graphique d'activité (aperçu)",
    category: "charts",
  },
  {
    type: "chart-deliveries-status",
    label: "Livraisons par statut",
    description: "Répartition des statuts de livraison",
    category: "charts",
  },
  {
    type: "recent-deliveries",
    label: "Livraisons récentes",
    description: "Dernières livraisons avec accès rapide",
    category: "activity",
  },
  {
    type: "quick-actions",
    label: "Raccourcis",
    description: "Accès rapide aux actions fréquentes",
    category: "shortcuts",
  },
  {
    type: "orders-footnote",
    label: "Total commandes",
    description: "Lien vers toutes vos commandes",
    category: "activity",
  },
];

export const PORTAL_COMPACT_DASHBOARD_WIDGETS = new Set(
  PORTAL_DASHBOARD_WIDGET_CATALOG.filter((entry) => entry.compact).map((entry) => entry.type)
);

export const PORTAL_DASHBOARD_WIDGET_CATEGORY_LABELS: Record<
  PortalDashboardWidgetCatalogEntry["category"],
  string
> = {
  stats: "Indicateurs",
  charts: "Graphiques",
  activity: "Activité",
  shortcuts: "Raccourcis",
};

const DEFAULT_VISIBLE: PortalDashboardWidgetType[] = ["stats-row", "recent-deliveries"];

export const DEFAULT_PORTAL_DASHBOARD_LAYOUT: PortalDashboardLayoutSettings = {
  widgets: PORTAL_DASHBOARD_WIDGET_TYPES.map((type, index) => ({
    type,
    visible: DEFAULT_VISIBLE.includes(type),
    order: DEFAULT_VISIBLE.includes(type)
      ? DEFAULT_VISIBLE.indexOf(type)
      : 100 + index,
  })),
};

function assignWidgetOrdersFromSequence(
  visible: PortalDashboardWidgetLayout[],
  hidden: PortalDashboardWidgetLayout[]
) {
  return [
    ...visible.map((widget, index) => ({ ...widget, order: index })),
    ...hidden.map((widget, index) => ({ ...widget, order: visible.length + index })),
  ];
}

function assignWidgetOrders(widgets: PortalDashboardWidgetLayout[]) {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  return assignWidgetOrdersFromSequence(
    sorted.filter((w) => w.visible),
    sorted.filter((w) => !w.visible)
  );
}

export function normalizePortalDashboardLayout(
  input?: Partial<PortalDashboardLayoutSettings> | null
): PortalDashboardLayoutSettings {
  const stored = input?.widgets ?? [];
  const byType = new Map(stored.map((widget) => [widget.type, widget]));

  const widgets = PORTAL_DASHBOARD_WIDGET_TYPES.map((type, index) => {
    const existing = byType.get(type);
    const fallback = DEFAULT_PORTAL_DASHBOARD_LAYOUT.widgets.find((w) => w.type === type)!;
    return {
      type,
      visible: existing?.visible ?? fallback.visible,
      order: existing?.order ?? fallback.order,
    };
  });

  return { widgets: assignWidgetOrders(widgets) };
}

export function getVisiblePortalDashboardWidgets(layout: PortalDashboardLayoutSettings) {
  return [...layout.widgets].filter((w) => w.visible).sort((a, b) => a.order - b.order);
}

export function groupPortalDashboardWidgets(widgets: PortalDashboardWidgetLayout[]) {
  const groups: { kind: "compact" | "full"; widgets: PortalDashboardWidgetLayout[] }[] = [];

  for (const widget of widgets) {
    const isCompact = PORTAL_COMPACT_DASHBOARD_WIDGETS.has(widget.type);
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

export function reorderPortalDashboardWidgets(
  widgets: PortalDashboardWidgetLayout[],
  type: PortalDashboardWidgetType,
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

export function movePortalDashboardWidgetToEdge(
  widgets: PortalDashboardWidgetLayout[],
  type: PortalDashboardWidgetType,
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

export function togglePortalDashboardWidget(
  widgets: PortalDashboardWidgetLayout[],
  type: PortalDashboardWidgetType,
  visible: boolean
) {
  const next = widgets.map((widget) =>
    widget.type === type ? { ...widget, visible } : widget
  );
  return assignWidgetOrders(next);
}

export function getPortalWidgetCatalogEntry(type: PortalDashboardWidgetType) {
  return PORTAL_DASHBOARD_WIDGET_CATALOG.find((entry) => entry.type === type);
}
