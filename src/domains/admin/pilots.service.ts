import { z } from "zod";
import type { PilotStage } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import {
  canTransition,
  NEEDS_FIRST_DELIVERY,
  PILOT_IN_PROGRESS,
  PILOT_STAGE_LABELS,
  PILOT_STAGES,
  PILOT_TERMINAL,
  PILOT_TRANSITIONS,
} from "@/domains/admin/pilot-stages";
import {
  ADMIN_HOME_DAYS,
  buildDailySeries,
  DELIVERED_STATUS,
  parisDayKey,
  parisDayStart,
  shiftDayKey,
  type AdminHomeDay,
} from "@/domains/admin/admin-home.service";

/**
 * ADMIN-ESPACE, lot 4 : suivi des pilotes accompagnés (docs/operations/pilot1).
 * Un pilote = une entreprise prospect accompagnée, liée ou non à une entreprise Annona.
 * Étapes, transitions et règles de cohérence des dates sont ici, pures et testées ; la lecture regroupe
 * les livraisons par entreprise (`groupBy`, aucun N+1). Jours civils à l'heure de Paris.
 * Aucun chiffre inventé : une lecture impossible vaut `null` (« Indisponible »).
 */

/* ---------- Étapes (fichier sans base de données, partagé avec l'écran) ---------- */

export {
  PILOT_STAGES,
  PILOT_STAGE_LABELS,
  PILOT_STAGE_HINTS,
  PILOT_IN_PROGRESS,
  PILOT_TERMINAL,
  PILOT_TRANSITIONS,
  canTransition,
} from "@/domains/admin/pilot-stages";

/* ---------- Jours ---------- */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DAY = "2020-01-01";
const MAX_DAY = "2100-12-31";

export function isCalendarDay(value: string) {
  if (!DATE_KEY.test(value) || value < MIN_DAY || value > MAX_DAY) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Colonne `DATE` lue par Prisma (minuit UTC) → « 2026-11-05 ». */
export function dayKeyOf(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** « 2026-11-05 » → valeur écrite dans une colonne `DATE`. */
export function dayValue(key: string | null): Date | null {
  return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

/** Jours écoulés depuis le début (le jour du début = 0) ; `null` sans début ou avant le début. */
export function daysSince(startKey: string | null, todayKey: string): number | null {
  if (!startKey || startKey > todayKey) return null;
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(todayKey) - toUtc(startKey)) / 86_400_000);
}

/* ---------- Validation (zod stricte) ---------- */

const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const optionalText = (max: number, label: string) =>
  z.preprocess(blankToNull, z.string().trim().max(max, { error: `${label} : ${max} caractères au plus` }).nullable()).optional();

const optionalDay = (label: string) =>
  z
    .preprocess(
      blankToNull,
      z.string().refine(isCalendarDay, { error: `${label} : date invalide (AAAA-MM-JJ)` }).nullable()
    )
    .optional();

const PHONE = /^[0-9+().\s-]{6,30}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const pilotFields = {
  name: z.string().trim().min(2, { error: "Nom du pilote : 2 caractères au moins" }).max(120, { error: "Nom du pilote : 120 caractères au plus" }),
  companyId: z
    .preprocess(blankToNull, z.string().regex(ID, { error: "Entreprise liée invalide" }).nullable())
    .optional(),
  contactName: optionalText(120, "Nom du contact"),
  contactEmail: z
    .preprocess(
      blankToNull,
      z.string().trim().max(254, { error: "E-mail du contact trop long" }).pipe(z.email({ error: "E-mail du contact invalide" })).nullable()
    )
    .optional(),
  contactPhone: z
    .preprocess(blankToNull, z.string().trim().regex(PHONE, { error: "Téléphone du contact invalide" }).nullable())
    .optional(),
  stage: z.enum(PILOT_STAGES, { error: "Étape inconnue" }).optional(),
  startDate: optionalDay("Début"),
  plannedEndDate: optionalDay("Fin prévue"),
  endDate: optionalDay("Fin réelle"),
  firstDeliveryDate: optionalDay("Première livraison"),
};

export const pilotCreateSchema = z.object(pilotFields).strict();

export const pilotUpdateSchema = z
  .object({ ...pilotFields, name: pilotFields.name.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: "Aucune modification" });

export const pilotNoteSchema = z
  .object({
    body: z.string().trim().min(1, { error: "Note vide" }).max(2000, { error: "Note : 2 000 caractères au plus" }),
  })
  .strict();

export type PilotCreateInput = z.infer<typeof pilotCreateSchema>;
export type PilotUpdateInput = z.infer<typeof pilotUpdateSchema>;

function firstIssue(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Saisie invalide";
  if (issue.code === "unrecognized_keys") return "Champ inconnu";
  return issue.message || "Saisie invalide";
}

export function parsePilotCreate(body: unknown): { data: PilotCreateInput } | { error: string } {
  const parsed = pilotCreateSchema.safeParse(body);
  return parsed.success ? { data: parsed.data } : { error: firstIssue(parsed.error) };
}

export function parsePilotUpdate(body: unknown): { data: PilotUpdateInput } | { error: string } {
  const parsed = pilotUpdateSchema.safeParse(body);
  return parsed.success ? { data: parsed.data } : { error: firstIssue(parsed.error) };
}

export function parsePilotNote(body: unknown): { data: { body: string } } | { error: string } {
  const parsed = pilotNoteSchema.safeParse(body);
  return parsed.success ? { data: parsed.data } : { error: firstIssue(parsed.error) };
}

/** Identifiant de pilote dans l'adresse : refusé avant toute lecture s'il est absurde. */
export function isPilotId(value: string | undefined): value is string {
  return typeof value === "string" && ID.test(value);
}

/* ---------- Cohérence ---------- */

export type PilotState = {
  stage: PilotStage;
  companyId: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  endDate: string | null;
  firstDeliveryDate: string | null;
};

export type FirstDelivery = { date: string; source: "manual" | "deduced" };

/** Saisie prioritaire ; sinon première livraison livrée de l'entreprise liée ; sinon inconnue. */
export function resolveFirstDelivery(manual: string | null, deduced: string | null): FirstDelivery | null {
  if (manual) return { date: manual, source: "manual" };
  if (deduced) return { date: deduced, source: "deduced" };
  return null;
}

/**
 * Valeurs posées automatiquement lors d'un changement d'étape, sauf si la requête les fixe elle-même :
 * début = aujourd'hui en entrant dans une étape commencée ; fin réelle = aujourd'hui à la sortie, effacée à la reprise.
 */
export function applyStageDefaults(
  previous: PilotStage | null,
  next: PilotState,
  explicit: ReadonlySet<keyof PilotState>,
  today: string
): PilotState {
  const state = { ...next };
  if (previous === state.stage) return state;
  const started = state.stage !== "PREPARATION" && state.stage !== "STOPPED";
  if (started && !state.startDate && !explicit.has("startDate")) state.startDate = today;
  const terminal = PILOT_TERMINAL.includes(state.stage);
  if (terminal && !state.endDate && !explicit.has("endDate")) state.endDate = today;
  if (!terminal && previous !== null && PILOT_TERMINAL.includes(previous) && !explicit.has("endDate")) state.endDate = null;
  return state;
}

/** Première incohérence trouvée, en français ; `null` si l'état peut être enregistré. */
export function checkPilotState(state: PilotState, today: string, deducedFirstDelivery: string | null): string | null {
  const { startDate, plannedEndDate, endDate, firstDeliveryDate, stage } = state;
  if (startDate && plannedEndDate && plannedEndDate < startDate) return "La fin prévue précède le début.";
  if (startDate && endDate && endDate < startDate) return "La fin réelle précède le début.";
  if (endDate && endDate > today) return "La fin réelle ne peut pas être dans le futur.";
  if (firstDeliveryDate && firstDeliveryDate > today) return "La première livraison ne peut pas être dans le futur.";
  if (startDate && firstDeliveryDate && firstDeliveryDate < startDate) return "La première livraison précède le début du pilote.";
  if (stage !== "PREPARATION" && stage !== "STOPPED" && !startDate) return "Un pilote commencé garde sa date de début.";
  if (stage !== "PREPARATION" && stage !== "STOPPED" && startDate && startDate > today) {
    return "Le pilote commence plus tard : il reste en Préparation jusqu'au début.";
  }
  if (endDate && !PILOT_TERMINAL.includes(stage)) {
    return "La fin réelle se saisit à la sortie : passez d'abord à Poursuite payante ou Arrêt.";
  }
  if (NEEDS_FIRST_DELIVERY.includes(stage) && !resolveFirstDelivery(firstDeliveryDate, deducedFirstDelivery)) {
    return "Première valeur : il faut une première livraison (date saisie ou livraison livrée par l'entreprise liée).";
  }
  return null;
}

/* ---------- Lecture ---------- */

export const PILOT_LIST_MAX = 200;
export const PILOT_NOTES_MAX = 200;
const NOTE_PREVIEW = 240;

type Args = Record<string, unknown>;
type PersonRow = { firstName: string; lastName: string } | null;
type NoteRow = { id: string; body: string; createdAt: Date; author: PersonRow };

type PilotRow = {
  id: string;
  name: string;
  companyId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: PilotStage;
  stageChangedAt: Date;
  startDate: Date | null;
  plannedEndDate: Date | null;
  endDate: Date | null;
  firstDeliveryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  company: { id: string; name: string; isDemo: boolean } | null;
  createdBy?: PersonRow;
  updatedBy?: PersonRow;
  notes: NoteRow[];
  _count: { notes: number };
};

export type PilotDatabase = {
  platformPilot: {
    findMany: (args: Args) => Promise<PilotRow[]>;
    findUnique: (args: Args) => Promise<PilotRow | null>;
    create: (args: Args) => Promise<{ id: string }>;
    updateMany: (args: Args) => Promise<{ count: number }>;
    count: (args: Args) => Promise<number>;
    groupBy: (args: Args) => Promise<Array<{ stage: PilotStage; _count: { _all: number } }>>;
  };
  platformPilotNote: { create: (args: Args) => Promise<{ id: string }> };
  company: { findUnique: (args: Args) => Promise<{ id: string } | null> };
  delivery: {
    groupBy: (args: Args) => Promise<Array<{ companyId: string; _min?: { completedAt: Date | null }; _count?: { _all: number } }>>;
    findMany: (args: Args) => Promise<Array<{ completedAt: Date | null }>>;
  };
  order: { findMany: (args: Args) => Promise<Array<{ createdAt: Date }>> };
};

const defaultDb = () => prisma as unknown as PilotDatabase;

export type PilotNote = { id: string; body: string; createdAt: string; author: string | null };

export type PilotListItem = {
  id: string;
  name: string;
  stage: PilotStage;
  stageChangedAt: string;
  company: { id: string; name: string; isDemo: boolean } | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  startDate: string | null;
  plannedEndDate: string | null;
  endDate: string | null;
  /** Saisie à la main (champ du formulaire). */
  firstDeliveryDate: string | null;
  /** Première livraison livrée de l'entreprise liée ; `null` si aucune, sans entreprise ou illisible. */
  deducedFirstDelivery: string | null;
  firstDelivery: FirstDelivery | null;
  daysSinceStart: number | null;
  /** Livraisons livrées ces 30 derniers jours ; `null` sans entreprise liée ou si la lecture échoue. */
  delivered30: number | null;
  /** `false` si les livraisons de l'entreprise n'ont pas pu être lues. */
  deliveriesReadable: boolean;
  lastNote: PilotNote | null;
  notesCount: number;
  updatedAt: string;
};

export type PilotList = {
  generatedAt: string;
  today: string;
  items: PilotListItem[];
  byStage: Record<PilotStage, number>;
  inProgress: number;
  truncated: boolean;
};

export type PilotDetail = PilotListItem & {
  createdAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  notes: PilotNote[];
  notesTruncated: boolean;
  /** Courbe 30 jours de l'entreprise liée ; `null` sans entreprise ou si la lecture échoue. */
  series: AdminHomeDay[] | null;
  allowedStages: PilotStage[];
  today: string;
};

const personName = (person: PersonRow | undefined) => {
  const name = person ? `${person.firstName} ${person.lastName}`.trim() : "";
  return name || null;
};

const toNote = (note: NoteRow, preview = false): PilotNote => ({
  id: note.id,
  body: preview && note.body.length > NOTE_PREVIEW ? `${note.body.slice(0, NOTE_PREVIEW - 1)}…` : note.body,
  createdAt: note.createdAt.toISOString(),
  author: personName(note.author),
});

const listSelect = {
  id: true,
  name: true,
  companyId: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  stage: true,
  stageChangedAt: true,
  startDate: true,
  plannedEndDate: true,
  endDate: true,
  firstDeliveryDate: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true, isDemo: true } },
  _count: { select: { notes: true } },
};

const noteSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { firstName: true, lastName: true } },
};

async function attempt<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** Première livraison livrée par entreprise (une requête groupée), jour de Paris. */
async function readFirstDeliveries(db: PilotDatabase, companyIds: string[]) {
  if (companyIds.length === 0) return new Map<string, string>();
  const rows = await db.delivery.groupBy({
    by: ["companyId"],
    where: { companyId: { in: companyIds }, status: DELIVERED_STATUS, completedAt: { not: null } },
    _min: { completedAt: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const first = row._min?.completedAt;
    if (first) map.set(row.companyId, parisDayKey(first));
  }
  return map;
}

function seriesStart(now: Date) {
  return parisDayStart(shiftDayKey(parisDayKey(now), -(ADMIN_HOME_DAYS - 1)));
}

/** Livraisons livrées sur les 30 jours de la courbe (jours de Paris), par entreprise, en une requête. */
async function readDelivered30(db: PilotDatabase, companyIds: string[], now: Date) {
  if (companyIds.length === 0) return new Map<string, number>();
  const rows = await db.delivery.groupBy({
    by: ["companyId"],
    where: { companyId: { in: companyIds }, status: DELIVERED_STATUS, completedAt: { gte: seriesStart(now) } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.companyId, Math.max(0, row._count?._all ?? 0)]));
}

function toListItem(
  row: PilotRow,
  today: string,
  firsts: Map<string, string> | null,
  delivered: Map<string, number> | null
): PilotListItem {
  const companyId = row.company?.id ?? null;
  const deduced = companyId && firsts ? (firsts.get(companyId) ?? null) : null;
  const manual = dayKeyOf(row.firstDeliveryDate);
  const startDate = dayKeyOf(row.startDate);
  const lastNote = row.notes[0];
  return {
    id: row.id,
    name: row.name,
    stage: row.stage,
    stageChangedAt: row.stageChangedAt.toISOString(),
    company: row.company,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    startDate,
    plannedEndDate: dayKeyOf(row.plannedEndDate),
    endDate: dayKeyOf(row.endDate),
    firstDeliveryDate: manual,
    deducedFirstDelivery: deduced,
    firstDelivery: resolveFirstDelivery(manual, deduced),
    daysSinceStart: daysSince(startDate, today),
    delivered30: companyId && delivered ? (delivered.get(companyId) ?? 0) : null,
    deliveriesReadable: companyId ? firsts !== null && delivered !== null : true,
    lastNote: lastNote ? toNote(lastNote, true) : null,
    notesCount: row._count.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function emptyByStage(): Record<PilotStage, number> {
  return Object.fromEntries(PILOT_STAGES.map((stage) => [stage, 0])) as Record<PilotStage, number>;
}

export async function listPilots(db: PilotDatabase = defaultDb(), now = new Date()): Promise<PilotList> {
  const today = parisDayKey(now);
  const rows = await db.platformPilot.findMany({
    orderBy: [{ stageChangedAt: "desc" }, { id: "asc" }],
    take: PILOT_LIST_MAX + 1,
    select: {
      ...listSelect,
      notes: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: noteSelect },
    },
  });
  const visible = rows.slice(0, PILOT_LIST_MAX);
  const companyIds = [...new Set(visible.flatMap((row) => (row.company ? [row.company.id] : [])))];
  const [firsts, delivered] = await Promise.all([
    attempt(() => readFirstDeliveries(db, companyIds)),
    attempt(() => readDelivered30(db, companyIds, now)),
  ]);
  const items = visible.map((row) => toListItem(row, today, firsts, delivered));
  const byStage = emptyByStage();
  for (const item of items) byStage[item.stage] += 1;
  return {
    generatedAt: now.toISOString(),
    today,
    items,
    byStage,
    inProgress: PILOT_IN_PROGRESS.reduce((sum, stage) => sum + byStage[stage], 0),
    truncated: rows.length > PILOT_LIST_MAX,
  };
}

export async function getPilot(id: string, db: PilotDatabase = defaultDb(), now = new Date()): Promise<PilotDetail | null> {
  const today = parisDayKey(now);
  const row = await db.platformPilot.findUnique({
    where: { id },
    select: {
      ...listSelect,
      createdBy: { select: { firstName: true, lastName: true } },
      updatedBy: { select: { firstName: true, lastName: true } },
      notes: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PILOT_NOTES_MAX + 1, select: noteSelect },
    },
  });
  if (!row) return null;
  const companyIds = row.company ? [row.company.id] : [];
  const start = seriesStart(now);
  const [firsts, delivered, series] = await Promise.all([
    attempt(() => readFirstDeliveries(db, companyIds)),
    attempt(() => readDelivered30(db, companyIds, now)),
    row.company
      ? attempt(async () => {
          const companyId = row.company!.id;
          const [orders, done] = await Promise.all([
            db.order.findMany({ where: { companyId, createdAt: { gte: start } }, select: { createdAt: true } }),
            db.delivery.findMany({
              where: { companyId, status: DELIVERED_STATUS, completedAt: { gte: start } },
              select: { completedAt: true },
            }),
          ]);
          return buildDailySeries(
            orders.map((order) => order.createdAt),
            done.flatMap((delivery) => (delivery.completedAt ? [delivery.completedAt] : [])),
            now
          );
        })
      : Promise.resolve(null),
  ]);
  const item = toListItem({ ...row, notes: row.notes.slice(0, 1) }, today, firsts, delivered);
  return {
    ...item,
    lastNote: row.notes[0] ? toNote(row.notes[0]) : null,
    createdAt: row.createdAt.toISOString(),
    createdBy: personName(row.createdBy),
    updatedBy: personName(row.updatedBy),
    notes: row.notes.slice(0, PILOT_NOTES_MAX).map((note) => toNote(note)),
    notesTruncated: row.notes.length > PILOT_NOTES_MAX,
    series,
    allowedStages: [...PILOT_TRANSITIONS[row.stage]],
    today,
  };
}

/* ---------- Écritures ---------- */

export type PilotWriteResult =
  | { status: "created" | "updated"; id: string }
  | { status: "invalid"; error: string }
  | { status: "not_found" }
  | { status: "conflict"; error: string };

const COMPANY_BUSY = "Cette entreprise suit déjà un pilote en cours.";

/** Entreprise liée : doit exister et ne pas suivre un autre pilote non terminé. */
async function checkCompany(db: PilotDatabase, companyId: string, exceptPilotId: string | null): Promise<PilotWriteResult | null> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return { status: "invalid", error: "Entreprise liée introuvable." };
  const busy = await db.platformPilot.count({
    where: {
      companyId,
      stage: { notIn: [...PILOT_TERMINAL] },
      ...(exceptPilotId ? { id: { not: exceptPilotId } } : {}),
    },
  });
  return busy > 0 ? { status: "conflict", error: COMPANY_BUSY } : null;
}

async function deducedFor(db: PilotDatabase, companyId: string | null) {
  if (!companyId) return null;
  // Lecture impossible : la règle de première valeur reste appliquée sans déduction (jamais d'invention).
  const firsts = await attempt(() => readFirstDeliveries(db, [companyId]));
  return firsts?.get(companyId) ?? null;
}

function stateData(state: PilotState) {
  return {
    stage: state.stage,
    companyId: state.companyId,
    startDate: dayValue(state.startDate),
    plannedEndDate: dayValue(state.plannedEndDate),
    endDate: dayValue(state.endDate),
    firstDeliveryDate: dayValue(state.firstDeliveryDate),
  };
}

function explicitKeys(input: Record<string, unknown>) {
  return new Set(Object.keys(input).filter((key) => input[key] !== undefined)) as Set<keyof PilotState>;
}

export async function createPilot(
  body: unknown,
  actorId: string,
  db: PilotDatabase = defaultDb(),
  now = new Date()
): Promise<PilotWriteResult> {
  const parsed = parsePilotCreate(body);
  if ("error" in parsed) return { status: "invalid", error: parsed.error };
  const input = parsed.data;
  const today = parisDayKey(now);
  const companyId = input.companyId ?? null;
  if (companyId) {
    const problem = await checkCompany(db, companyId, null);
    if (problem) return problem;
  }
  const state = applyStageDefaults(
    null,
    {
      stage: input.stage ?? "PREPARATION",
      companyId,
      startDate: input.startDate ?? null,
      plannedEndDate: input.plannedEndDate ?? null,
      endDate: input.endDate ?? null,
      firstDeliveryDate: input.firstDeliveryDate ?? null,
    },
    explicitKeys(input),
    today
  );
  const error = checkPilotState(state, today, await deducedFor(db, companyId));
  if (error) return { status: "invalid", error };
  const created = await db.platformPilot.create({
    data: {
      name: input.name,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      ...stateData(state),
      stageChangedAt: now,
      createdById: actorId,
      updatedById: actorId,
    },
    select: { id: true },
  });
  return { status: "created", id: created.id };
}

export async function updatePilot(
  id: string,
  body: unknown,
  actorId: string,
  db: PilotDatabase = defaultDb(),
  now = new Date()
): Promise<PilotWriteResult> {
  const parsed = parsePilotUpdate(body);
  if ("error" in parsed) return { status: "invalid", error: parsed.error };
  const input = parsed.data;
  const current = await db.platformPilot.findUnique({
    where: { id },
    select: { ...listSelect, notes: { take: 0, select: { id: true } } },
  });
  if (!current) return { status: "not_found" };

  const today = parisDayKey(now);
  const previous: PilotState = {
    stage: current.stage,
    companyId: current.companyId,
    startDate: dayKeyOf(current.startDate),
    plannedEndDate: dayKeyOf(current.plannedEndDate),
    endDate: dayKeyOf(current.endDate),
    firstDeliveryDate: dayKeyOf(current.firstDeliveryDate),
  };
  const nextStage = input.stage ?? previous.stage;
  if (nextStage !== previous.stage && !canTransition(previous.stage, nextStage)) {
    return {
      status: "invalid",
      error: `Passage impossible de « ${PILOT_STAGE_LABELS[previous.stage]} » à « ${PILOT_STAGE_LABELS[nextStage]} ».`,
    };
  }
  const merged: PilotState = {
    stage: nextStage,
    companyId: input.companyId !== undefined ? input.companyId : previous.companyId,
    startDate: input.startDate !== undefined ? input.startDate : previous.startDate,
    plannedEndDate: input.plannedEndDate !== undefined ? input.plannedEndDate : previous.plannedEndDate,
    endDate: input.endDate !== undefined ? input.endDate : previous.endDate,
    firstDeliveryDate: input.firstDeliveryDate !== undefined ? input.firstDeliveryDate : previous.firstDeliveryDate,
  };
  if (merged.companyId && merged.companyId !== previous.companyId) {
    const problem = await checkCompany(db, merged.companyId, id);
    if (problem) return problem;
  }
  const state = applyStageDefaults(previous.stage, merged, explicitKeys(input), today);
  const error = checkPilotState(state, today, await deducedFor(db, state.companyId));
  if (error) return { status: "invalid", error };

  // Verrou optimiste : si le pilote a changé depuis la lecture, rien n'est écrit.
  const written = await db.platformPilot.updateMany({
    where: { id, updatedAt: current.updatedAt },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...stateData(state),
      ...(state.stage !== previous.stage ? { stageChangedAt: now } : {}),
      updatedById: actorId,
      updatedAt: now,
    },
  });
  if (written.count === 0) {
    return { status: "conflict", error: "Ce pilote vient d'être modifié ailleurs : rechargez la page." };
  }
  return { status: "updated", id };
}

export async function addPilotNote(
  id: string,
  body: unknown,
  actorId: string,
  db: PilotDatabase = defaultDb()
): Promise<PilotWriteResult> {
  const parsed = parsePilotNote(body);
  if ("error" in parsed) return { status: "invalid", error: parsed.error };
  const pilot = await db.platformPilot.findUnique({ where: { id }, select: { id: true } });
  if (!pilot) return { status: "not_found" };
  const note = await db.platformPilotNote.create({
    data: { pilotId: id, authorId: actorId, body: parsed.data.body },
    select: { id: true },
  });
  return { status: "created", id: note.id };
}
