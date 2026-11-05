import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  addPilotNote,
  applyStageDefaults,
  canTransition,
  checkPilotState,
  createPilot,
  daysSince,
  getPilot,
  isCalendarDay,
  listPilots,
  parsePilotCreate,
  parsePilotNote,
  parsePilotUpdate,
  PILOT_LIST_MAX,
  PILOT_STAGES,
  PILOT_TRANSITIONS,
  resolveFirstDelivery,
  updatePilot,
  type PilotDatabase,
  type PilotState,
} from "../src/domains/admin/pilots.service";
import { summarizePilotStages } from "../src/domains/admin/admin-home.service";
import { adminSearchQueries, searchPlatform, type AdminSearchDatabase } from "../src/domains/admin/search.service";

/** 6 novembre 2026, 10 h à Paris. */
const NOW = new Date("2026-11-06T09:00:00.000Z");
const TODAY = "2026-11-06";

/* ====================== Validation ====================== */

test("ADMIN-ESPACE pilotes : validation stricte de la création (champs, e-mail, téléphone, dates, étape)", () => {
  const ok = parsePilotCreate({
    name: "  Coursiers du Nord ",
    companyId: "",
    contactName: "",
    contactEmail: "lea@coursiers.fr",
    contactPhone: "+33 6 12 34 56 78",
    startDate: "2026-11-02",
    plannedEndDate: "",
    stage: "ACTIVATION",
  });
  assert.ok("data" in ok);
  assert.equal(ok.data.name, "Coursiers du Nord");
  assert.equal(ok.data.companyId, null);
  assert.equal(ok.data.contactName, null);
  assert.equal(ok.data.plannedEndDate, null);

  const refused: Array<[Record<string, unknown>, string]> = [
    [{ name: "A" }, "Nom du pilote : 2 caractères au moins"],
    [{ name: "x".repeat(121) }, "Nom du pilote : 120 caractères au plus"],
    [{ name: "Pilote", role: "SUPER_ADMIN" }, "Champ inconnu"],
    [{ name: "Pilote", contactEmail: "pas-un-mail" }, "E-mail du contact invalide"],
    [{ name: "Pilote", contactPhone: "appelez-moi" }, "Téléphone du contact invalide"],
    [{ name: "Pilote", startDate: "2026-02-30" }, "Début : date invalide (AAAA-MM-JJ)"],
    [{ name: "Pilote", plannedEndDate: "06/11/2026" }, "Fin prévue : date invalide (AAAA-MM-JJ)"],
    [{ name: "Pilote", firstDeliveryDate: "1999-12-31" }, "Première livraison : date invalide (AAAA-MM-JJ)"],
    [{ name: "Pilote", stage: "TERMINE" }, "Étape inconnue"],
    [{ name: "Pilote", companyId: "c'; DROP" }, "Entreprise liée invalide"],
  ];
  for (const [body, message] of refused) {
    const parsed = parsePilotCreate(body);
    assert.ok("error" in parsed, JSON.stringify(body));
    assert.equal(parsed.error, message, JSON.stringify(body));
  }
  assert.ok("error" in parsePilotCreate(null));
  assert.ok("error" in parsePilotCreate([]));

  assert.deepEqual(parsePilotUpdate({}), { error: "Aucune modification" });
  assert.deepEqual(parsePilotUpdate({ stage: "FIRST_VALUE" }), { data: { stage: "FIRST_VALUE" } });
  assert.deepEqual(parsePilotUpdate({ createdById: "x" }), { error: "Champ inconnu" });

  assert.deepEqual(parsePilotNote({ body: "  Point hebdo fait.  " }), { data: { body: "Point hebdo fait." } });
  assert.deepEqual(parsePilotNote({ body: "   " }), { error: "Note vide" });
  assert.deepEqual(parsePilotNote({ body: "x".repeat(2001) }), { error: "Note : 2 000 caractères au plus" });
  assert.deepEqual(parsePilotNote({ body: "ok", authorId: "u2" }), { error: "Champ inconnu" });

  assert.equal(isCalendarDay("2028-02-29"), true);
  assert.equal(isCalendarDay("2026-02-29"), false);
  assert.equal(isCalendarDay("2026-13-01"), false);
});

/* ====================== Cohérence et étapes ====================== */

const base: PilotState = {
  stage: "ACTIVATION",
  companyId: null,
  startDate: "2026-11-02",
  plannedEndDate: "2026-11-30",
  endDate: null,
  firstDeliveryDate: null,
};

test("ADMIN-ESPACE pilotes : dates incohérentes refusées", () => {
  assert.equal(checkPilotState(base, TODAY, null), null);
  const cases: Array<[Partial<PilotState>, string]> = [
    [{ plannedEndDate: "2026-11-01" }, "La fin prévue précède le début."],
    [{ stage: "STOPPED", endDate: "2026-11-01" }, "La fin réelle précède le début."],
    [{ stage: "STOPPED", endDate: "2026-11-07" }, "La fin réelle ne peut pas être dans le futur."],
    [{ firstDeliveryDate: "2026-11-07" }, "La première livraison ne peut pas être dans le futur."],
    [{ firstDeliveryDate: "2026-11-01" }, "La première livraison précède le début du pilote."],
    [{ startDate: null }, "Un pilote commencé garde sa date de début."],
    [{ startDate: "2026-11-09", plannedEndDate: null }, "Le pilote commence plus tard : il reste en Préparation jusqu'au début."],
    [{ endDate: "2026-11-05" }, "La fin réelle se saisit à la sortie : passez d'abord à Poursuite payante ou Arrêt."],
  ];
  for (const [patch, message] of cases) assert.equal(checkPilotState({ ...base, ...patch }, TODAY, null), message, JSON.stringify(patch));
  // Préparation : début futur et absence de début acceptés.
  assert.equal(checkPilotState({ ...base, stage: "PREPARATION", startDate: "2026-12-01", plannedEndDate: "2026-12-29" }, TODAY, null), null);
  assert.equal(checkPilotState({ ...base, stage: "PREPARATION", startDate: null, plannedEndDate: null }, TODAY, null), null);
});

test("ADMIN-ESPACE pilotes : première valeur exige une première livraison, saisie ou déduite", () => {
  const firstValue = { ...base, stage: "FIRST_VALUE" as const };
  assert.match(checkPilotState(firstValue, TODAY, null) ?? "", /il faut une première livraison/);
  assert.equal(checkPilotState(firstValue, TODAY, "2026-11-04"), null);
  assert.equal(checkPilotState({ ...firstValue, firstDeliveryDate: "2026-11-03" }, TODAY, null), null);
  for (const stage of ["REPRESENTATIVE_USE", "CONSOLIDATION"] as const) {
    assert.match(checkPilotState({ ...base, stage }, TODAY, null) ?? "", /première livraison/, stage);
  }
  // Un arrêt ne demande pas de première livraison.
  assert.equal(checkPilotState({ ...base, stage: "STOPPED", endDate: TODAY }, TODAY, null), null);

  assert.deepEqual(resolveFirstDelivery("2026-11-03", "2026-11-04"), { date: "2026-11-03", source: "manual" });
  assert.deepEqual(resolveFirstDelivery(null, "2026-11-04"), { date: "2026-11-04", source: "deduced" });
  assert.equal(resolveFirstDelivery(null, null), null);
});

test("ADMIN-ESPACE pilotes : transitions d'étape et dates posées automatiquement", () => {
  assert.deepEqual([...PILOT_STAGES], ["PREPARATION", "ACTIVATION", "FIRST_VALUE", "REPRESENTATIVE_USE", "CONSOLIDATION", "CONTINUED", "STOPPED"]);
  assert.equal(canTransition("PREPARATION", "ACTIVATION"), true);
  assert.equal(canTransition("PREPARATION", "FIRST_VALUE"), false, "pas de saut d'étape");
  assert.equal(canTransition("ACTIVATION", "PREPARATION"), true, "retour en arrière pour corriger");
  assert.equal(canTransition("REPRESENTATIVE_USE", "CONTINUED"), false, "poursuite seulement après consolidation");
  assert.equal(canTransition("CONSOLIDATION", "CONTINUED"), true);
  assert.equal(canTransition("CONTINUED", "STOPPED"), false);
  assert.equal(canTransition("STOPPED", "REPRESENTATIVE_USE"), true, "reprise après arrêt");
  assert.equal(canTransition("STOPPED", "CONTINUED"), false);
  for (const stage of ["PREPARATION", "ACTIVATION", "FIRST_VALUE", "REPRESENTATIVE_USE", "CONSOLIDATION"] as const) {
    assert.equal(PILOT_TRANSITIONS[stage].includes("STOPPED"), true, stage);
  }
  for (const [from, targets] of Object.entries(PILOT_TRANSITIONS)) assert.equal(targets.includes(from as never), false, from);

  const none = new Set<keyof PilotState>();
  const prep = { ...base, stage: "PREPARATION" as const, startDate: null, plannedEndDate: null };
  assert.equal(applyStageDefaults("PREPARATION", { ...prep, stage: "ACTIVATION" }, none, TODAY).startDate, TODAY);
  assert.equal(applyStageDefaults("PREPARATION", { ...prep, stage: "STOPPED" }, none, TODAY).startDate, null, "arrêt en préparation : pas de début inventé");
  assert.equal(applyStageDefaults("PREPARATION", { ...prep, stage: "STOPPED" }, none, TODAY).endDate, TODAY);
  assert.equal(applyStageDefaults("CONSOLIDATION", { ...base, stage: "CONTINUED" }, none, TODAY).endDate, TODAY);
  assert.equal(applyStageDefaults("STOPPED", { ...base, stage: "ACTIVATION", endDate: "2026-11-05" }, none, TODAY).endDate, null, "reprise : fin effacée");
  assert.equal(
    applyStageDefaults("CONSOLIDATION", { ...base, stage: "STOPPED", endDate: "2026-11-05" }, new Set(["endDate"]), TODAY).endDate,
    "2026-11-05",
    "fin saisie conservée"
  );
  assert.deepEqual(applyStageDefaults("ACTIVATION", base, none, TODAY), base, "même étape : rien ne change");

  assert.equal(daysSince("2026-11-02", TODAY), 4);
  assert.equal(daysSince(TODAY, TODAY), 0);
  assert.equal(daysSince("2026-11-09", TODAY), null);
  assert.equal(daysSince(null, TODAY), null);
  assert.equal(daysSince("2026-10-20", "2026-10-26"), 6, "changement d'heure du 25 octobre sans décalage");
});

/* ====================== Service (base simulée) ====================== */

type Call = { model: string; method: string; args: Record<string, unknown> };
const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

function pilotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Coursiers du Nord",
    companyId: "c1",
    contactName: "Léa",
    contactEmail: "lea@coursiers.fr",
    contactPhone: null,
    stage: "ACTIVATION",
    stageChangedAt: new Date("2026-11-02T08:00:00.000Z"),
    startDate: day("2026-11-02"),
    plannedEndDate: day("2026-11-30"),
    endDate: null,
    firstDeliveryDate: null,
    createdAt: new Date("2026-11-01T08:00:00.000Z"),
    updatedAt: new Date("2026-11-05T08:00:00.000Z"),
    company: { id: "c1", name: "E2E Transports", isDemo: false },
    createdBy: { firstName: "Super", lastName: "Admin" },
    updatedBy: null,
    notes: [],
    _count: { notes: 0 },
    ...overrides,
  };
}

interface FakeOptions {
  pilots?: Array<ReturnType<typeof pilotRow>>;
  companyExists?: boolean;
  busy?: number;
  firstDeliveredAt?: Date | null;
  delivered30?: number;
  failDeliveries?: boolean;
  updated?: number;
}

function fakeDb(calls: Call[], options: FakeOptions = {}): PilotDatabase {
  const record = (model: string, method: string, args: Record<string, unknown>) => calls.push({ model, method, args });
  const pilots = options.pilots ?? [pilotRow()];
  return {
    platformPilot: {
      findMany: async (args) => { record("platformPilot", "findMany", args); return pilots as never; },
      findUnique: async (args) => {
        record("platformPilot", "findUnique", args);
        return (pilots.find((row) => row.id === (args.where as { id: string }).id) ?? null) as never;
      },
      create: async (args) => { record("platformPilot", "create", args); return { id: "p-new" }; },
      updateMany: async (args) => { record("platformPilot", "updateMany", args); return { count: options.updated ?? 1 }; },
      count: async (args) => { record("platformPilot", "count", args); return options.busy ?? 0; },
      groupBy: async (args) => { record("platformPilot", "groupBy", args); return []; },
    },
    platformPilotNote: { create: async (args) => { record("platformPilotNote", "create", args); return { id: "n-new" }; } },
    company: {
      findUnique: async (args) => {
        record("company", "findUnique", args);
        return options.companyExists === false ? null : { id: (args.where as { id: string }).id };
      },
    },
    delivery: {
      groupBy: async (args) => {
        record("delivery", "groupBy", args);
        if (options.failDeliveries) throw new Error("down");
        const ids = ((args.where as { companyId: { in: string[] } }).companyId.in);
        if ("_min" in args) {
          return options.firstDeliveredAt === null ? [] : ids.map((companyId) => ({ companyId, _min: { completedAt: options.firstDeliveredAt ?? new Date("2026-11-03T16:30:00.000Z") } }));
        }
        return ids.map((companyId) => ({ companyId, _count: { _all: options.delivered30 ?? 7 } }));
      },
      findMany: async (args) => {
        record("delivery", "findMany", args);
        return [{ completedAt: new Date("2026-11-05T10:00:00.000Z") }, { completedAt: null }];
      },
    },
    order: {
      findMany: async (args) => {
        record("order", "findMany", args);
        return [{ createdAt: new Date("2026-11-05T08:00:00.000Z") }, { createdAt: new Date("2026-11-06T08:00:00.000Z") }];
      },
    },
  };
}

test("ADMIN-ESPACE pilotes : création contrôlée (entreprise, pilote déjà en cours, dates, auteur)", async () => {
  const calls: Call[] = [];
  const created = await createPilot(
    { name: "E2E Pilote", companyId: "c1", startDate: "2026-11-02", stage: "ACTIVATION" },
    "admin-1",
    fakeDb(calls),
    NOW
  );
  assert.deepEqual(created, { status: "created", id: "p-new" });
  const create = calls.find((call) => call.method === "create")!.args as { data: Record<string, unknown>; select: unknown };
  assert.equal(create.data.createdById, "admin-1");
  assert.equal(create.data.updatedById, "admin-1");
  assert.equal(create.data.stage, "ACTIVATION");
  assert.deepEqual(create.data.startDate, day("2026-11-02"));
  assert.equal(create.data.endDate, null);
  assert.deepEqual(create.data.stageChangedAt, NOW);
  assert.deepEqual(create.select, { id: true });
  const busyCheck = calls.find((call) => call.model === "platformPilot" && call.method === "count")!.args;
  assert.deepEqual(busyCheck.where, { companyId: "c1", stage: { notIn: ["CONTINUED", "STOPPED"] } });

  // Activation sans début : début = aujourd'hui (Paris).
  const started: Call[] = [];
  await createPilot({ name: "Sans début", stage: "ACTIVATION" }, "admin-1", fakeDb(started), NOW);
  assert.deepEqual((started.find((call) => call.method === "create")!.args.data as { startDate: Date }).startDate, day(TODAY));

  assert.deepEqual(
    await createPilot({ name: "E2E", companyId: "absent" }, "admin-1", fakeDb([], { companyExists: false }), NOW),
    { status: "invalid", error: "Entreprise liée introuvable." }
  );
  assert.deepEqual(
    await createPilot({ name: "E2E", companyId: "c1" }, "admin-1", fakeDb([], { busy: 1 }), NOW),
    { status: "conflict", error: "Cette entreprise suit déjà un pilote en cours." }
  );
  const refused: Call[] = [];
  const invalid = await createPilot({ name: "E2E", startDate: "2026-11-10", plannedEndDate: "2026-11-01" }, "admin-1", fakeDb(refused), NOW);
  assert.deepEqual(invalid, { status: "invalid", error: "La fin prévue précède le début." });
  assert.equal(refused.some((call) => call.method === "create"), false);

  // Première valeur dès la création : acceptée si l'entreprise liée a déjà livré, refusée sinon.
  assert.equal((await createPilot({ name: "E2E", companyId: "c1", stage: "FIRST_VALUE", startDate: "2026-11-02" }, "a", fakeDb([]), NOW)).status, "created");
  assert.equal(
    (await createPilot({ name: "E2E", companyId: "c1", stage: "FIRST_VALUE", startDate: "2026-11-02" }, "a", fakeDb([], { firstDeliveredAt: null }), NOW)).status,
    "invalid"
  );
});

test("ADMIN-ESPACE pilotes : changement d'étape, première livraison déduite et verrou optimiste", async () => {
  assert.deepEqual(await updatePilot("absent", { stage: "FIRST_VALUE" }, "a", fakeDb([]), NOW), { status: "not_found" });

  const jump = await updatePilot("p1", { stage: "CONSOLIDATION" }, "a", fakeDb([]), NOW);
  assert.deepEqual(jump, { status: "invalid", error: "Passage impossible de « Activation » à « Consolidation et sortie »." });

  // Sans livraison livrée ni date saisie : première valeur refusée.
  const noDelivery = await updatePilot("p1", { stage: "FIRST_VALUE" }, "a", fakeDb([], { firstDeliveredAt: null }), NOW);
  assert.equal(noDelivery.status, "invalid");

  // Livraison livrée par l'entreprise liée : acceptée, étape et auteur écrits sous verrou (updatedAt lu).
  const calls: Call[] = [];
  assert.deepEqual(await updatePilot("p1", { stage: "FIRST_VALUE" }, "admin-2", fakeDb(calls), NOW), { status: "updated", id: "p1" });
  const update = calls.find((call) => call.method === "updateMany")!.args as { where: unknown; data: Record<string, unknown> };
  assert.deepEqual(update.where, { id: "p1", updatedAt: new Date("2026-11-05T08:00:00.000Z") });
  assert.equal(update.data.stage, "FIRST_VALUE");
  assert.equal(update.data.updatedById, "admin-2");
  assert.deepEqual(update.data.stageChangedAt, NOW);
  assert.equal(update.data.firstDeliveryDate, null, "la date déduite n'est pas recopiée dans la saisie");

  // Date saisie à la main sans entreprise liée : acceptée.
  const manual = fakeDb([], { pilots: [pilotRow({ companyId: null, company: null })] });
  assert.equal((await updatePilot("p1", { stage: "FIRST_VALUE", firstDeliveryDate: "2026-11-04" }, "a", manual, NOW)).status, "updated");

  // Sortie : fin réelle posée ; écriture concurrente : conflit, rien n'est perdu en silence.
  const exit: Call[] = [];
  const consolidating = fakeDb(exit, { pilots: [pilotRow({ stage: "CONSOLIDATION" })] });
  assert.equal((await updatePilot("p1", { stage: "CONTINUED" }, "a", consolidating, NOW)).status, "updated");
  assert.deepEqual((exit.find((call) => call.method === "updateMany")!.args.data as { endDate: Date }).endDate, day(TODAY));
  assert.deepEqual(
    await updatePilot("p1", { name: "Nouveau nom" }, "a", fakeDb([], { updated: 0 }), NOW),
    { status: "conflict", error: "Ce pilote vient d'être modifié ailleurs : rechargez la page." }
  );

  // Changer d'entreprise : contrôlée ; garder la même : pas de contrôle de doublon.
  const same: Call[] = [];
  await updatePilot("p1", { companyId: "c1", contactName: "Marc" }, "a", fakeDb(same), NOW);
  assert.equal(same.some((call) => call.model === "company"), false);
  assert.deepEqual(await updatePilot("p1", { companyId: "c2" }, "a", fakeDb([], { busy: 1 }), NOW), {
    status: "conflict",
    error: "Cette entreprise suit déjà un pilote en cours.",
  });
});

test("ADMIN-ESPACE pilotes : notes de suivi (auteur, pilote absent, texte vide)", async () => {
  const calls: Call[] = [];
  assert.deepEqual(await addPilotNote("p1", { body: " Premier point hebdo. " }, "admin-1", fakeDb(calls)), { status: "created", id: "n-new" });
  assert.deepEqual(calls.find((call) => call.model === "platformPilotNote")!.args, {
    data: { pilotId: "p1", authorId: "admin-1", body: "Premier point hebdo." },
    select: { id: true },
  });
  assert.deepEqual(await addPilotNote("absent", { body: "x" }, "a", fakeDb([])), { status: "not_found" });
  const empty: Call[] = [];
  assert.deepEqual(await addPilotNote("p1", { body: "" }, "a", fakeDb(empty)), { status: "invalid", error: "Note vide" });
  assert.equal(empty.length, 0, "aucune lecture pour une note invalide");
});

test("ADMIN-ESPACE pilotes : liste par étape, première livraison saisie ou déduite, livraisons 30 jours groupées", async () => {
  const calls: Call[] = [];
  const longNote = { id: "n1", body: "x".repeat(300), createdAt: new Date("2026-11-05T15:00:00.000Z"), author: { firstName: "Super", lastName: "Admin" } };
  const db = fakeDb(calls, {
    pilots: [
      pilotRow({ notes: [longNote], _count: { notes: 2 } }),
      pilotRow({ id: "p2", name: "Manuel", firstDeliveryDate: day("2026-11-02"), company: { id: "c2", name: "Autre", isDemo: true }, companyId: "c2" }),
      pilotRow({ id: "p3", name: "Sans entreprise", stage: "PREPARATION", companyId: null, company: null, startDate: null }),
    ],
  });
  const list = await listPilots(db, NOW);
  assert.equal(list.today, TODAY);
  assert.equal(list.truncated, false);
  assert.equal(list.inProgress, 2);
  assert.equal(list.byStage.PREPARATION, 1);
  assert.equal(list.byStage.ACTIVATION, 2);
  const [deduced, manual, alone] = list.items;
  assert.deepEqual(deduced!.firstDelivery, { date: "2026-11-03", source: "deduced" });
  assert.equal(deduced!.delivered30, 7);
  assert.equal(deduced!.daysSinceStart, 4);
  assert.equal(deduced!.lastNote!.body.length, 240);
  assert.equal(deduced!.lastNote!.author, "Super Admin");
  assert.equal(deduced!.notesCount, 2);
  assert.deepEqual(manual!.firstDelivery, { date: "2026-11-02", source: "manual" });
  assert.equal(manual!.deducedFirstDelivery, "2026-11-03");
  assert.equal(alone!.firstDelivery, null);
  assert.equal(alone!.delivered30, null);
  assert.equal(alone!.daysSinceStart, null);
  assert.equal(alone!.deliveriesReadable, true);

  const findMany = calls.find((call) => call.method === "findMany" && call.model === "platformPilot")!.args;
  assert.equal(findMany.take, PILOT_LIST_MAX + 1);
  const groups = calls.filter((call) => call.model === "delivery" && call.method === "groupBy");
  assert.equal(groups.length, 2, "deux requêtes groupées pour toutes les entreprises, aucun N+1");
  for (const group of groups) {
    assert.deepEqual((group.args.where as { companyId: unknown }).companyId, { in: ["c1", "c2"] });
    assert.equal((group.args.where as { status: string }).status, "DELIVERED");
  }
  // Livraison livrée à 17 h 30 le 3 novembre à Paris (16 h 30 UTC) : jour de Paris.
  const late = await listPilots(fakeDb([], { firstDeliveredAt: new Date("2026-11-03T23:30:00.000Z") }), NOW);
  assert.equal(late.items[0]!.firstDelivery!.date, "2026-11-04");

  // Lecture des livraisons impossible : « Indisponible », jamais zéro.
  const down = await listPilots(fakeDb([], { failDeliveries: true }), NOW);
  assert.equal(down.items[0]!.delivered30, null);
  assert.equal(down.items[0]!.firstDelivery, null);
  assert.equal(down.items[0]!.deliveriesReadable, false);

  const empty = await listPilots(fakeDb([], { pilots: [] }), NOW);
  assert.equal(empty.items.length, 0);
  assert.equal(empty.inProgress, 0);
});

test("ADMIN-ESPACE pilotes : fiche avec notes, courbe 30 jours de l'entreprise liée et passages autorisés", async () => {
  assert.equal(await getPilot("absent", fakeDb([]), NOW), null);
  const notes = [
    { id: "n2", body: "Deuxième", createdAt: new Date("2026-11-05T15:00:00.000Z"), author: null },
    { id: "n1", body: "Première", createdAt: new Date("2026-11-04T15:00:00.000Z"), author: { firstName: "Super", lastName: "Admin" } },
  ];
  const detail = await getPilot("p1", fakeDb([], { pilots: [pilotRow({ notes, _count: { notes: 2 } })] }), NOW);
  assert.ok(detail);
  assert.deepEqual(detail.notes.map((note) => [note.body, note.author]), [["Deuxième", null], ["Première", "Super Admin"]]);
  assert.equal(detail.lastNote!.body, "Deuxième");
  assert.equal(detail.series!.length, 30);
  assert.deepEqual(detail.series!.at(-1), { day: TODAY, orders: 1, delivered: 0 });
  assert.deepEqual(detail.series!.at(-2), { day: "2026-11-05", orders: 1, delivered: 1 });
  assert.deepEqual(detail.allowedStages, ["PREPARATION", "FIRST_VALUE", "STOPPED"]);
  assert.equal(detail.createdBy, "Super Admin");
  assert.equal(detail.updatedBy, null);

  const alone = await getPilot("p1", fakeDb([], { pilots: [pilotRow({ companyId: null, company: null })] }), NOW);
  assert.equal(alone!.series, null);
});

test("ADMIN-ESPACE pilotes : compteur de l'accueil (en cours, en préparation, sortis)", () => {
  assert.deepEqual(
    summarizePilotStages([
      { stage: "PREPARATION", _count: { _all: 2 } },
      { stage: "ACTIVATION", _count: { _all: 1 } },
      { stage: "REPRESENTATIVE_USE", _count: { _all: 3 } },
      { stage: "CONTINUED", _count: { _all: 1 } },
      { stage: "STOPPED", _count: { _all: 1 } },
    ]),
    { inProgress: 4, preparing: 2, finished: 2 }
  );
  assert.deepEqual(summarizePilotStages([]), { inProgress: 0, preparing: 0, finished: 0 });
});

/* ====================== Recherche globale ====================== */

test("ADMIN-ESPACE pilotes : la recherche globale trouve un pilote par son nom, son contact ou son entreprise", async () => {
  const where = adminSearchQueries("nord léa").pilots.where;
  assert.deepEqual(where.AND[0], {
    OR: [
      { name: { contains: "nord", mode: "insensitive" } },
      { contactName: { contains: "nord", mode: "insensitive" } },
      { contactEmail: { contains: "nord", mode: "insensitive" } },
      { company: { is: { name: { contains: "nord", mode: "insensitive" } } } },
    ],
  });
  assert.equal(where.AND.length, 2);

  const empty = async () => [];
  const db: AdminSearchDatabase = {
    company: { findMany: empty },
    user: { findMany: empty },
    order: { findMany: empty },
    contactMessage: { findMany: empty },
    platformPilot: {
      findMany: async () => [{ id: "p1", name: "E2E Pilote lot4 Nord", stage: "FIRST_VALUE", contactName: "Léa", company: { name: "E2E Transports" } }],
    },
  };
  const result = await searchPlatform({ q: "nord" }, db);
  const pilots = result.groups.find((group) => group.type === "pilots")!;
  assert.equal(pilots.label, "Pilotes");
  assert.deepEqual(pilots.items, [
    {
      id: "p1",
      type: "pilots",
      title: "E2E Pilote lot4 Nord",
      detail: "E2E Transports · Léa",
      badge: "Première valeur",
      href: "/admin/pilots/p1",
    },
  ]);
});

/* ====================== Routes ====================== */

type Handler = (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;
type RouteModule = Partial<Record<"GET" | "POST" | "PATCH", Handler>>;

function loadRoute(file: string, role: string, calls: string[], service: Record<string, unknown>): RouteModule {
  const module = { exports: {} as RouteModule };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, URL, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async (permission: string) => {
          calls.push(`staff:${permission}`);
          if (role === "ANONYMOUS") return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
          return { context: { user: { id: "actor-1", role: { systemRole: role } } } };
        },
        requireRole: (_context: unknown, roles: string[]) =>
          roles.length === 1 && roles[0] === "SUPER_ADMIN" && role === "SUPER_ADMIN"
            ? null
            : NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      };
      if (id === "@/lib/api/platform-access") return {
        gatePlatformRead: async (_context: unknown, denied: Response | null, resource: string) => {
          calls.push(`audit:GET:${resource}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        },
        gatePlatformWrite: async (_context: unknown, denied: Response | null, resource: string, method: string) => {
          calls.push(`audit:${method}:${resource}:${denied ? "DENIED" : "ALLOWED"}`);
          return denied;
        },
      };
      if (id === "@/domains/admin/pilots.service") return service;
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports;
}

const params = (id = "p1") => ({ params: Promise.resolve({ id }) });
const jsonRequest = (body: unknown) => new Request("http://local/api/admin/pilots", { method: "POST", body: JSON.stringify(body) });

function pilotService(calls: string[], result: unknown = { status: "created", id: "p-new" }) {
  return {
    isPilotId: (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id),
    listPilots: async () => { calls.push("service"); return { items: [] }; },
    getPilot: async (id: string) => { calls.push("service"); return id === "p1" ? { id } : null; },
    createPilot: async (_body: unknown, actorId: string) => { calls.push(`service:${actorId}`); return result; },
    updatePilot: async (_id: string, _body: unknown, actorId: string) => { calls.push(`service:${actorId}`); return result; },
    addPilotNote: async (_id: string, _body: unknown, actorId: string) => { calls.push(`service:${actorId}`); return result; },
  };
}

const ROUTES: Array<[string, "GET" | "POST" | "PATCH", string]> = [
  ["src/app/api/admin/pilots/route.ts", "GET", "GET"],
  ["src/app/api/admin/pilots/route.ts", "POST", "POST"],
  ["src/app/api/admin/pilots/[id]/route.ts", "GET", "GET"],
  ["src/app/api/admin/pilots/[id]/route.ts", "PATCH", "PATCH"],
  ["src/app/api/admin/pilots/[id]/notes/route.ts", "POST", "POST"],
];

test("ADMIN-ESPACE pilotes : routes refusées sans session (401) et aux autres rôles (403), refus journalisés", async () => {
  for (const [file, method, audited] of ROUTES) {
    const anonymous: string[] = [];
    const unauth = await loadRoute(file, "ANONYMOUS", anonymous, pilotService(anonymous))[method]!(jsonRequest({ name: "x" }), params());
    assert.equal(unauth.status, 401, `${file} ${method}`);
    assert.deepEqual(anonymous, ["staff:dashboard:admin"]);

    for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"]) {
      const calls: string[] = [];
      const denied = await loadRoute(file, role, calls, pilotService(calls))[method]!(jsonRequest({ name: "x" }), params());
      assert.equal(denied.status, 403, `${file} ${method} ${role}`);
      assert.deepEqual(calls, ["staff:dashboard:admin", `audit:${audited}:COMPANIES:DENIED`], `${file} ${method} ${role}`);
    }
  }
});

test("ADMIN-ESPACE pilotes : réponses du super-administrateur (201, 400, 404, 409), sans cache", async () => {
  const run = async (file: string, method: "GET" | "POST" | "PATCH", result: unknown, id = "p1") => {
    const calls: string[] = [];
    const response = await loadRoute(file, "SUPER_ADMIN", calls, pilotService(calls, result))[method]!(jsonRequest({ name: "E2E" }), params(id));
    assert.equal(response.headers.get("Cache-Control"), "no-store", `${file} ${method}`);
    return { response, calls, body: await response.json() };
  };
  const list = "src/app/api/admin/pilots/route.ts";
  const detail = "src/app/api/admin/pilots/[id]/route.ts";
  const notes = "src/app/api/admin/pilots/[id]/notes/route.ts";

  const created = await run(list, "POST", { status: "created", id: "p-new" });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.body.data, { id: "p-new" });
  assert.deepEqual(created.calls, ["staff:dashboard:admin", "audit:POST:COMPANIES:ALLOWED", "service:actor-1"]);
  assert.equal((await run(list, "POST", { status: "invalid", error: "La fin prévue précède le début." })).response.status, 400);
  assert.equal((await run(list, "POST", { status: "conflict", error: "Cette entreprise suit déjà un pilote en cours." })).response.status, 409);
  assert.equal((await run(list, "GET", null)).response.status, 200);

  assert.equal((await run(detail, "GET", null)).response.status, 200);
  assert.equal((await run(detail, "GET", null, "absent")).response.status, 404);
  const badId = await run(detail, "GET", null, "../../etc");
  assert.equal(badId.response.status, 404);
  assert.equal(badId.calls.includes("service"), false, "identifiant absurde refusé avant toute lecture");
  assert.equal((await run(detail, "PATCH", { status: "updated", id: "p1" })).response.status, 200);
  assert.equal((await run(detail, "PATCH", { status: "not_found" })).response.status, 404);
  assert.equal((await run(detail, "PATCH", { status: "conflict", error: "Ce pilote vient d'être modifié ailleurs : rechargez la page." })).response.status, 409);
  assert.equal((await run(detail, "PATCH", { status: "invalid", error: "Passage impossible" })).response.status, 400);

  assert.equal((await run(notes, "POST", { status: "created", id: "n1" })).response.status, 201);
  assert.equal((await run(notes, "POST", { status: "not_found" })).response.status, 404);
  assert.equal((await run(notes, "POST", { status: "invalid", error: "Note vide" })).response.status, 400);
});
