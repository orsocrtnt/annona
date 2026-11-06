import type { SystemRole } from "@prisma/client";

const CLIENT_PREFIX = "Client ";
const DRIVER_PREFIX = "Livreur ";
/** Ancien mot, encore présent dans des noms déjà enregistrés sur les livraisons. */
const LEGACY_DRIVER_PREFIX = "Chauffeur ";

function stripPrefix(name: string, prefix: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trimStart();
  }
  return trimmed;
}

export function formatClientDisplayName(name: string | null | undefined): string {
  if (!name?.trim()) return "Client";
  const base = stripPrefix(name, CLIENT_PREFIX);
  return base ? `${CLIENT_PREFIX}${base}` : "Client";
}

export function formatDriverDisplayName(name: string | null | undefined): string {
  if (!name?.trim()) return "Livreur";
  const base = stripPrefix(stripPrefix(name, LEGACY_DRIVER_PREFIX), DRIVER_PREFIX);
  return base ? `${DRIVER_PREFIX}${base}` : "Livreur";
}

export function formatClientFromParts(
  customer?: { firstName: string; lastName: string } | null,
  fallback?: string | null
): string {
  if (customer) {
    const name = `${customer.firstName} ${customer.lastName}`.trim();
    if (name) return formatClientDisplayName(name);
  }
  if (fallback?.trim()) return formatClientDisplayName(fallback.trim());
  return "Client";
}

export function formatDriverFromParts(
  driver?: { firstName: string; lastName: string } | null,
  driverName?: string | null,
  options?: { unassignedLabel?: string }
): string {
  const unassigned = options?.unassignedLabel ?? "Non assigné";
  if (driver) {
    const name = `${driver.firstName} ${driver.lastName}`.trim();
    if (name) return formatDriverDisplayName(name);
  }
  if (driverName?.trim()) return formatDriverDisplayName(driverName.trim());
  return unassigned;
}

export function formatPersonNameByRole(
  firstName: string,
  lastName: string,
  systemRole: SystemRole
): string {
  const name = `${firstName} ${lastName}`.trim();
  if (!name) {
    if (systemRole === "DRIVER") return "Livreur";
    if (systemRole === "MERCHANT") return "Client";
    return "—";
  }
  if (systemRole === "DRIVER") return formatDriverDisplayName(name);
  if (systemRole === "MERCHANT") return formatClientDisplayName(name);
  return name;
}

/** Nom seul, sans « Client » / « Livreur » : quand le libellé du champ dit déjà le rôle. */
export function withoutRolePrefix(name: string | null | undefined): string {
  return stripPrefix(stripPrefix(stripPrefix(name ?? "", CLIENT_PREFIX), LEGACY_DRIVER_PREFIX), DRIVER_PREFIX);
}
