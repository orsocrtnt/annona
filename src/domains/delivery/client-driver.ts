import type { Prisma } from "@prisma/client";

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

// Événements d'affectation créés par le personnel ou le dispatch automatique qui citent des
// livreurs (delivery.service.ts : assignation, réassignation, retrait ; acknowledge : refus).
const DRIVER_EVENT_LABELS = new Set([
  "Assignée automatiquement",
  "Livreur réassigné",
  "Réassignation forcée",
  "Assignation forcée",
  "Assignée au livreur",
  "Livreur retiré",
  "Prise en charge confirmée",
  "Mission refusée — retour au dispatch",
]);

const FORMER_DRIVER = /\s*(?:—\s*)?livreur précédemment assigné\s*:.*$/i;

// Filet « Livreur <Nom…> » : le prénom (majuscule initiale) puis les mots du nom, particules
// courtes en minuscules comprises (de, du, de la, van der, d'Arc…), jusqu'à la ponctuation, une
// flèche, un tiret ou un mot ordinaire. Seul le premier mot est gardé.
const NAME_WORD = "\\p{Lu}[\\p{L}'’-]*";
const ELIDED_PARTICLE = "\\p{Ll}{1,3}['’]\\p{Lu}[\\p{L}'’-]*";
const PARTICLE = "\\p{Ll}{1,3}";
const PREFIXED_NAME = new RegExp(
  `([Ll]ivreur\\s+)(${NAME_WORD})(?:\\s+(?:${PARTICLE}\\s+)*(?:${NAME_WORD}|${ELIDED_PARTICLE}))*`,
  "gu"
);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nom connu : « Livreur Prénom Nom », « Prénom Nom » (stocké) ou fiche { firstName, lastName }. */
export type KnownDriverName = string | { firstName: string; lastName: string } | null | undefined;

/** Chaque nom complet connu → motif (mot entier, sans casse) qui le réduit au prénom. */
function fullNamePatterns(driverNames: ReadonlyArray<KnownDriverName>) {
  const entries = driverNames.flatMap((name) => {
    if (!name) return [];
    const full = typeof name === "string" ? name.trim().replace(DRIVER_PREFIX, "") : `${name.firstName} ${name.lastName}`;
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return [];
    const firstName = typeof name === "string" ? parts[0]! : name.firstName.trim() || parts[0]!;
    return [{ parts, firstName }];
  });
  // Les noms les plus longs d'abord : « Jean Dupont-Martin » avant « Jean Dupont ».
  return entries
    .sort((a, b) => b.parts.join(" ").length - a.parts.join(" ").length)
    .map(({ parts, firstName }) => ({
      pattern: new RegExp(`(?<![\\p{L}'’-])${parts.map(escapeRegExp).join("\\s+")}(?![\\p{L}'’-])`, "giu"),
      firstName,
    }));
}

/**
 * Chronologie vue par un client : aucune mention du nom d'un livreur, aucun événement supprimé.
 * Les événements sont partagés avec le back-office (qui garde le nom complet) : le masquage se fait
 * en lecture. `driverNames` : noms complets connus (tous les livreurs de l'entreprise, inactifs
 * compris, et le nom stocké de la livraison), réduits au prénom où qu'ils apparaissent, puis filet
 * « Livreur <Nom…> » pour un nom inconnu (livreur supprimé).
 */
export function redactClientTimeline<T extends { label: string; description: string | null }>(
  events: T[],
  driverNames: ReadonlyArray<KnownDriverName> = []
): T[] {
  const known = fullNamePatterns(driverNames);
  return events.map((event) => {
    if (!event.description) return event;
    if (DRIVER_EVENT_LABELS.has(event.label)) return { ...event, description: null };
    let description = event.description.replace(FORMER_DRIVER, "");
    for (const { pattern, firstName } of known) description = description.replace(pattern, firstName);
    description = description.replace(PREFIXED_NAME, "$1$2");
    return description === event.description ? event : { ...event, description };
  });
}

/** Noms des livreurs de l'entreprise, inactifs compris, chargés une fois par réponse client. */
export async function loadCompanyDriverNames(db: Pick<Prisma.TransactionClient, "user">, companyId: string) {
  return db.user.findMany({
    where: { companyId, role: { systemRole: "DRIVER" } },
    select: { firstName: true, lastName: true },
  });
}

/** Auteur d'un message vu par un client : un livreur n'apparaît que par son prénom. */
export function clientAuthorName(authorName: string, authorRole: string): string {
  if (authorRole !== "DRIVER") return authorName;
  return clientDriverFirstName(null, authorName) ?? "Livreur";
}
