import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";

/**
 * Remise à l'heure d'un espace de démo préparé à l'avance (DEMO-REFONTE, partie 2).
 *
 * Les dates du scénario sont relatives à l'instant d'ancrage (préparation de l'espace).
 * Un espace attend parfois des heures dans le pool avant d'être prêté : sans recalage,
 * les livraisons prévues « dans 2 h » sont déjà en retard à l'ouverture. Au prêt, toutes
 * les dates des données de l'espace avancent du temps passé en réserve.
 */

export const DEMO_SCENARIO_ANCHOR_KEY = "demoScenarioAnchorAt";

const ANCHOR_PATH = `{${DEMO_SCENARIO_ANCHOR_KEY}}`;

/** Pas du décalage : garde les heures du scénario sur le quart d'heure. */
export const DEMO_SHIFT_STEP_MS = 15 * 60 * 1000;

type ShiftScope =
  | { companyField: string }
  | { parentField: string; parentModel: "Order" | "Delivery" | "SupportTicket" | "User" };

/** Modèles dont toutes les dates avancent avec l'horloge du scénario. */
export const DEMO_SHIFTED_MODELS: Record<string, ShiftScope> = {
  Order: { companyField: "companyId" },
  Delivery: { companyField: "companyId" },
  Invoice: { companyField: "companyId" },
  InvoiceReminder: { companyField: "companyId" },
  SupportTicket: { companyField: "companyId" },
  RecurringOrder: { companyField: "companyId" },
  InboundOrderEmail: { companyField: "companyId" },
  OrderTrackingLink: { companyField: "companyId" },
  TrackingEvent: { parentField: "deliveryId", parentModel: "Delivery" },
  SupportTicketMessage: { parentField: "ticketId", parentModel: "SupportTicket" },
  OrderMessage: { parentField: "orderId", parentModel: "Order" },
  OrderThreadRead: { parentField: "orderId", parentModel: "Order" },
  DriverLocation: { parentField: "driverId", parentModel: "User" },
  ClientNotification: { parentField: "userId", parentModel: "User" },
};

/**
 * Modèles rattachés à une entreprise ou à ses données, mais dont les dates ne racontent
 * pas la journée de démo : comptes, abonnement, quotas, bail du pool, tâches techniques.
 */
export const DEMO_UNSHIFTED_MODELS: Record<string, string> = {
  User: "comptes du roster figé",
  CustomerAddress: "carnet d'adresses, dates non affichées",
  CompanyCustomer: "rattachement client, dates non affichées",
  DemoPoolEnvironment: "bail du pool",
  OperationJob: "tâches techniques du serveur",
  SignupJourney: "inscription",
  SaasSubscription: "abonnement",
  SaasUsagePeriod: "période de facturation SaaS",
  SaasUsageEvent: "décompte du quota",
  SaasSeatReservation: "réservation de place",
  InvoiceCounter: "compteur de numérotation",
  OrderIntakeUsage: "décompte du quota",
  CompanyIntakeChannel: "réglage d'entreprise",
  DriverPushSubscription: "abonnement aux notifications du téléphone",
  SalesAttribution: "commission commerciale",
  PlatformPilot: "suivi des pilotes (super admin)",
  PlatformPilotNote: "suivi des pilotes (super admin)",
  ContactMessage: "messages du site public",
  ProspectCampaign: "prospection (super admin)",
  ProspectOptOut: "prospection (super admin)",
};

function modelOf(name: string) {
  const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name);
  if (!model) throw new Error(`DEMO_SHIFT_MODEL_UNKNOWN:${name}`);
  return model;
}

function tableOf(name: string): string {
  const model = modelOf(name);
  return model.dbName ?? model.name;
}

function columnOf(modelName: string, fieldName: string): string {
  const field = modelOf(modelName).fields.find((candidate) => candidate.name === fieldName);
  if (!field) throw new Error(`DEMO_SHIFT_FIELD_UNKNOWN:${modelName}.${fieldName}`);
  return field.dbName ?? field.name;
}

/** Une requête par modèle : $1 = entreprise, $2 = décalage en millisecondes. */
export function buildDemoShiftStatements(): string[] {
  return Object.entries(DEMO_SHIFTED_MODELS).map(([name, scope]) => {
    const dateColumns = modelOf(name)
      .fields.filter((field) => field.type === "DateTime")
      .map((field) => field.dbName ?? field.name);
    if (dateColumns.length === 0) throw new Error(`DEMO_SHIFT_NO_DATE:${name}`);
    const assignments = dateColumns
      .map((column) => `"${column}" = "${column}" + ($2::bigint * interval '1 millisecond')`)
      .join(", ");
    const where = "companyField" in scope
      ? `"${columnOf(name, scope.companyField)}" = $1`
      : `"${columnOf(name, scope.parentField)}" IN (SELECT "id" FROM "${tableOf(scope.parentModel)}" WHERE "${columnOf(scope.parentModel, "companyId")}" = $1)`;
    return `UPDATE "${tableOf(name)}" SET ${assignments} WHERE ${where}`;
  });
}

/** Décalage arrondi au quart d'heure ; 0 quand l'espace est déjà à l'heure. */
export function demoShiftMs(anchor: Date, now: Date): number {
  return Math.round((now.getTime() - anchor.getTime()) / DEMO_SHIFT_STEP_MS) * DEMO_SHIFT_STEP_MS;
}

export function readDemoScenarioAnchor(settings: unknown): Date | null {
  if (!settings || typeof settings !== "object") return null;
  const raw = (settings as Record<string, unknown>)[DEMO_SCENARIO_ANCHOR_KEY];
  if (typeof raw !== "string") return null;
  const anchor = new Date(raw);
  return Number.isNaN(anchor.getTime()) ? null : anchor;
}

/** Écrit l'ancrage et fait avancer `updated_at` : une réclamation de réglages concurrente échoue au lieu d'écraser. */
function anchorStatement(companyId: string, anchor: Date) {
  return prisma.$executeRaw`UPDATE "companies" SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), ${ANCHOR_PATH}::text[], to_jsonb(${anchor.toISOString()}::text)), "updated_at" = GREATEST((now() AT TIME ZONE 'UTC')::timestamp(3), "updated_at" + interval '1 millisecond') WHERE "id" = ${companyId}`;
}

export async function setDemoScenarioAnchor(companyId: string, anchor: Date): Promise<void> {
  await anchorStatement(companyId, anchor);
}

/**
 * Avance toutes les dates de l'espace du temps écoulé depuis l'ancrage, puis déplace l'ancrage.
 * Un espace préparé avant l'ancrage explicite prend la date de sa commande la plus récente.
 */
export async function realignDemoScenarioClock(
  companyId: string,
  now: Date = new Date()
): Promise<{ shiftedMs: number }> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
  let anchor = readDemoScenarioAnchor(company?.settings);
  if (!anchor) {
    const latest = await prisma.order.aggregate({ where: { companyId }, _max: { createdAt: true } });
    anchor = latest._max.createdAt;
  }
  if (!anchor) return { shiftedMs: 0 };

  const shiftedMs = demoShiftMs(anchor, now);
  if (shiftedMs === 0) return { shiftedMs: 0 };

  await prisma.$transaction([
    ...buildDemoShiftStatements().map((sql) => prisma.$executeRawUnsafe(sql, companyId, shiftedMs)),
    anchorStatement(companyId, new Date(anchor.getTime() + shiftedMs)),
  ]);
  return { shiftedMs };
}
