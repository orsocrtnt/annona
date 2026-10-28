/**
 * Données du livreur visibles par un client (décision du propriétaire) : prénom, et téléphone
 * seulement si l'administrateur ne l'a pas masqué. Jamais le nom de famille. Le masquage se fait
 * dans la requête (select) et dans ces fonctions, pas dans l'interface.
 */

const DRIVER_PREFIX = /^livreur\s+/i;

export type ClientDriver = { firstName: string; phone?: string | null };

/** Sélection Prisma du livreur pour un client : pas de nom de famille, téléphone sous réglage. */
export function clientDriverSelect(showPhone: boolean) {
  return showPhone ? ({ firstName: true, phone: true } as const) : ({ firstName: true } as const);
}

/** Prénom depuis la relation, sinon depuis le nom stocké (« Livreur Prénom Nom » ou « Prénom Nom »). */
export function clientDriverFirstName(
  driver: { firstName?: string | null } | null | undefined,
  driverName?: string | null
): string | null {
  const direct = driver?.firstName?.trim();
  if (direct) return direct;
  const stored = driverName?.trim().replace(DRIVER_PREFIX, "").trim();
  return stored ? (stored.split(/\s+/)[0] ?? null) : null;
}

export function toClientDriver(
  source: { driver?: { firstName?: string | null; phone?: string | null } | null; driverName?: string | null },
  showPhone: boolean
): ClientDriver | null {
  const firstName = clientDriverFirstName(source.driver, source.driverName);
  if (!firstName) return null;
  const phone = showPhone ? source.driver?.phone?.trim() || null : null;
  return phone ? { firstName, phone } : { firstName };
}

/** Libellé court affiché au client : « Livreur Prénom ». */
export function clientDriverLabel(driverName: string | null | undefined): string | null {
  const firstName = clientDriverFirstName(null, driverName);
  return firstName ? `Livreur ${firstName}` : null;
}

// Événements créés par le personnel qui citent des livreurs (affectation, retrait, refus).
const DRIVER_EVENT_LABELS = new Set([
  "Chauffeur réassigné",
  "Réassignation forcée",
  "Assignation forcée",
  "Assignée au chauffeur",
  "Chauffeur retiré",
  "Prise en charge confirmée",
  "Mission refusée — retour au dispatch",
]);

const FORMER_DRIVER = /\s*(?:—\s*)?chauffeur précédemment assigné\s*:.*$/i;
const PREFIXED_NAME = /Livreur\s+(\p{Lu}[\p{L}'’-]*)(?:\s+\p{Lu}[\p{L}'’-]*)*/gu;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nom complet connu (« Livreur Prénom Nom » ou « Prénom Nom ») → motif qui le réduit au prénom. */
function fullNamePatterns(driverNames: ReadonlyArray<string | null | undefined>) {
  return driverNames.flatMap((name) => {
    const parts = name?.trim().replace(DRIVER_PREFIX, "").trim().split(/\s+/).filter(Boolean) ?? [];
    if (parts.length < 2) return [];
    return [{ pattern: new RegExp(`(?<!\\p{L})${parts.map(escapeRegExp).join("\\s+")}(?!\\p{L})`, "giu"), firstName: parts[0]! }];
  });
}

/**
 * Chronologie vue par un client : aucune mention du nom d'un livreur, aucun événement supprimé.
 * Les événements sont partagés avec le back-office (qui garde le nom complet) : le masquage se fait
 * en lecture. `driverNames` : noms complets connus pour la livraison (driverName stocké), réduits au
 * prénom où qu'ils apparaissent, avec ou sans le préfixe « Livreur ».
 */
export function redactClientTimeline<T extends { label: string; description: string | null }>(
  events: T[],
  driverNames: ReadonlyArray<string | null | undefined> = []
): T[] {
  const known = fullNamePatterns(driverNames);
  return events.map((event) => {
    if (!event.description) return event;
    if (DRIVER_EVENT_LABELS.has(event.label)) return { ...event, description: null };
    let description = event.description.replace(FORMER_DRIVER, "");
    for (const { pattern, firstName } of known) description = description.replace(pattern, firstName);
    description = description.replace(PREFIXED_NAME, "Livreur $1");
    return description === event.description ? event : { ...event, description };
  });
}

/** Auteur d'un message vu par un client : un livreur n'apparaît que par son prénom. */
export function clientAuthorName(authorName: string, authorRole: string): string {
  if (authorRole !== "DRIVER") return authorName;
  return clientDriverFirstName(null, authorName) ?? "Livreur";
}
