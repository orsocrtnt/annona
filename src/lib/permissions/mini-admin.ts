export const MINI_ADMIN_MODULE_IDS = [
  "dashboard",
  "analytics",
  "orders",
  "dispatch",
  "driver-map",
  "delivery-map",
  "clients",
  "drivers",
  "accounts",
  "billing",
  "settings",
] as const;

export type MiniAdminModuleId = (typeof MINI_ADMIN_MODULE_IDS)[number];

export type MiniAdminModuleGroup = "ops" | "admin";

export const MINI_ADMIN_MODULES: {
  id: MiniAdminModuleId;
  label: string;
  group: MiniAdminModuleGroup;
  hrefs: string[];
  match: "exact" | "prefix";
  permissions: string[];
}[] = [
  {
    id: "dashboard",
    label: "Tableau de bord",
    group: "ops",
    hrefs: ["/dashboard"],
    match: "exact",
    permissions: ["dashboard:company", "orders:read"],
  },
  {
    id: "analytics",
    label: "Analyse",
    group: "ops",
    hrefs: ["/dashboard/analytics"],
    match: "prefix",
    permissions: ["analytics:read", "orders:read", "invoices:read"],
  },
  {
    id: "orders",
    label: "Commandes",
    group: "ops",
    hrefs: ["/dashboard/orders"],
    match: "prefix",
    permissions: ["orders:read", "orders:create", "orders:update"],
  },
  {
    id: "dispatch",
    label: "Dispatch",
    group: "ops",
    hrefs: ["/dispatch"],
    match: "exact",
    permissions: [
      "deliveries:read",
      "deliveries:create",
      "deliveries:update",
      "deliveries:delete",
      "deliveries:dispatch",
      "dashboard:dispatcher",
    ],
  },
  {
    id: "driver-map",
    label: "Carte chauffeurs",
    group: "ops",
    hrefs: ["/dispatch/drivers"],
    match: "prefix",
    permissions: ["deliveries:read", "drivers:read", "dashboard:dispatcher"],
  },
  {
    id: "delivery-map",
    label: "Carte livraison",
    group: "ops",
    hrefs: ["/dispatch/map"],
    match: "prefix",
    permissions: ["deliveries:read", "dashboard:dispatcher"],
  },
  {
    id: "clients",
    label: "Clients",
    group: "ops",
    hrefs: ["/dashboard/clients"],
    match: "prefix",
    permissions: ["orders:read"],
  },
  {
    id: "drivers",
    label: "Chauffeurs",
    group: "ops",
    hrefs: ["/dashboard/drivers"],
    match: "prefix",
    permissions: ["drivers:read", "drivers:manage"],
  },
  {
    id: "accounts",
    label: "Gestion des comptes",
    group: "admin",
    hrefs: ["/users"],
    match: "prefix",
    permissions: ["users:read", "users:create", "users:update", "users:delete"],
  },
  {
    id: "billing",
    label: "Facturation",
    group: "admin",
    hrefs: ["/settings/billing"],
    match: "prefix",
    permissions: [
      "invoices:read",
      "invoices:create",
      "invoices:update",
      "settings:read",
      "settings:update",
    ],
  },
  {
    id: "settings",
    label: "Paramètres",
    group: "admin",
    hrefs: ["/settings"],
    match: "exact",
    permissions: ["settings:read", "settings:update", "companies:read", "companies:update"],
  },
];

export const MINI_ADMIN_MODULE_GROUPS: { id: MiniAdminModuleGroup; label: string }[] = [
  { id: "ops", label: "Exploitation" },
  { id: "admin", label: "Administration" },
];

export type MiniAdminSettings = {
  title: string;
  modules: MiniAdminModuleId[];
};

function isModuleId(value: unknown): value is MiniAdminModuleId {
  return (
    typeof value === "string" &&
    (MINI_ADMIN_MODULE_IDS as readonly string[]).includes(value)
  );
}

export function parseMiniAdminSettings(settings: unknown): MiniAdminSettings {
  const raw =
    settings && typeof settings === "object" && "miniAdmin" in settings
      ? (settings as { miniAdmin?: unknown }).miniAdmin
      : null;

  if (!raw || typeof raw !== "object") {
    return {
      title: "",
      modules: [...MINI_ADMIN_MODULE_IDS],
    };
  }

  const record = raw as { title?: unknown; modules?: unknown };
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const modules = Array.isArray(record.modules)
    ? record.modules.filter(isModuleId)
    : [...MINI_ADMIN_MODULE_IDS];

  return {
    title,
    modules: modules.length > 0 ? modules : [...MINI_ADMIN_MODULE_IDS],
  };
}

export function buildMiniAdminSettings(title: string, modules: MiniAdminModuleId[]) {
  return {
    miniAdmin: {
      title: title.trim(),
      modules,
    },
  };
}

export function filterMiniAdminPermissions(
  rolePermissions: string[],
  settings: unknown
): string[] {
  const { modules } = parseMiniAdminSettings(settings);
  const allowed = new Set(
    MINI_ADMIN_MODULES.filter((mod) => modules.includes(mod.id)).flatMap(
      (mod) => mod.permissions
    )
  );
  return rolePermissions.filter((slug) => allowed.has(slug));
}

function hrefMatchesModule(
  href: string,
  prefix: string,
  match: "exact" | "prefix"
): boolean {
  if (match === "exact") return href === prefix;
  return href === prefix || href.startsWith(`${prefix}/`);
}

export function miniAdminAllowsHref(href: string, modules: MiniAdminModuleId[]): boolean {
  return MINI_ADMIN_MODULES.some(
    (mod) =>
      modules.includes(mod.id) &&
      mod.hrefs.some((prefix) => hrefMatchesModule(href, prefix, mod.match))
  );
}

export function getMiniAdminHomePath(settings: unknown): string {
  const { modules } = parseMiniAdminSettings(settings);
  const first = MINI_ADMIN_MODULES.find((mod) => modules.includes(mod.id));
  return first?.hrefs[0] ?? "/dashboard";
}
