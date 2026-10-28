import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type JobStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
type Job = {
  id: string;
  jobKey: string;
  type: "AUTO_DISPATCH" | "CLIENT_NOTIFICATION";
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  lockedAt: Date | null;
  lastError: string | null;
  completedAt: Date | null;
  companyId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Row = Record<string, unknown>;

function load<T>(deps: Record<string, unknown>): T {
  const module = { exports: {} };
  const js = ts.transpileModule(
    readFileSync(resolve("src/domains/operations/operation-job.service.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  runInNewContext(js, {
    Date,
    Error,
    Promise,
    Set,
    console: { error: () => undefined },
    exports: module.exports,
    module,
    require: (id: string) => {
      assert.ok(id in deps, `Unexpected dependency ${id}`);
      return deps[id];
    },
  });
  return module.exports as T;
}

function fixture(options?: {
  failNotification?: boolean;
  failFirstNotification?: boolean;
  slowFirstDispatchFailure?: boolean;
}) {
  const base = new Date("2026-10-05T12:00:00.000Z");
  const jobs: Job[] = [];
  const executions: string[] = [];
  let releaseFirstDispatch: (() => void) | null = null;
  let signalFirstDispatch: (() => void) | null = null;
  let notificationAttempts = 0;
  const firstDispatchStarted = new Promise<void>((resolve) => {
    signalFirstDispatch = resolve;
  });

  const clone = (job: Job) => ({ ...job });
  const matches = (job: Job, where: Row): boolean => {
    if (where.OR) return (where.OR as Row[]).some((part) => matches(job, part));
    for (const [key, value] of Object.entries(where)) {
      if (key === "OR") continue;
      const actual = job[key as keyof Job];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const condition = value as Row;
        if ("in" in condition && !(condition.in as unknown[]).includes(actual)) return false;
        if ("lte" in condition && (actual as Date).getTime() > (condition.lte as Date).getTime()) return false;
      } else if (actual !== value) {
        return false;
      }
    }
    return true;
  };

  const select = (job: Job, selection?: Row) => {
    if (!selection) return clone(job);
    return Object.fromEntries(
      Object.entries(selection)
        .filter(([, enabled]) => enabled)
        .map(([key]) => [key, job[key as keyof Job]])
    );
  };

  const applyData = (job: Job, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in (value as Row)) {
        (job as unknown as Row)[key] =
          ((job as unknown as Row)[key] as number) + ((value as Row).increment as number);
      } else {
        (job as unknown as Row)[key] = value;
      }
    }
    job.updatedAt = new Date();
  };

  const prisma = {
    operationJob: {
      upsert: async ({ where, create, select: selection }: { where: Row; create: Row; select?: Row }) => {
        let job = jobs.find((candidate) => candidate.jobKey === where.jobKey);
        if (!job) {
          job = {
            id: `job-${jobs.length + 1}`,
            jobKey: create.jobKey as string,
            type: create.type as Job["type"],
            status: "PENDING",
            payload: create.payload as Record<string, unknown>,
            attempts: 0,
            maxAttempts: (create.maxAttempts as number | undefined) ?? 3,
            nextAttemptAt: base,
            lockedAt: null,
            lastError: null,
            completedAt: null,
            companyId: (create.companyId as string | null | undefined) ?? null,
            createdAt: base,
            updatedAt: base,
          };
          jobs.push(job);
        }
        return select(job, selection);
      },
      findUnique: async ({ where }: { where: Row }) => {
        const job = jobs.find((candidate) => candidate.id === where.id);
        return job ? clone(job) : null;
      },
      findUniqueOrThrow: async ({ where }: { where: Row }) => {
        const job = jobs.find((candidate) => candidate.id === where.id);
        if (!job) throw new Error("NOT_FOUND");
        return clone(job);
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const selected = jobs.filter((job) => matches(job, where));
        selected.forEach((job) => applyData(job, data));
        return { count: selected.length };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const job = jobs.find((candidate) => candidate.id === where.id);
        if (!job) throw new Error("NOT_FOUND");
        applyData(job, data);
        return clone(job);
      },
      findMany: async ({ where, take, select: selection }: { where: Row; take?: number; select?: Row }) =>
        jobs.filter((job) => matches(job, where)).slice(0, take).map((job) => select(job, selection)),
      count: async ({ where }: { where: Row }) => jobs.filter((job) => matches(job, where)).length,
    },
  };

  const service = load<typeof import("../src/domains/operations/operation-job.service")>({
    "@/services/prisma/client": { prisma },
    "@/lib/operations/after-response": { runAfterResponse: (task: () => Promise<unknown>) => void task() },
    "@/domains/saas/saas.service": { assertSaasMutationFeature: async () => ({}) },
    "@/domains/delivery/auto-dispatch.service": {
      tryAutoAssignDelivery: async (_companyId: string, deliveryId: string) => {
        executions.push(`dispatch:${deliveryId}`);
        if (options?.slowFirstDispatchFailure && executions.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstDispatch = resolve;
            signalFirstDispatch?.();
          });
          throw new Error("PREMIER_WORKER_EXPIRE");
        }
        return { assigned: true };
      },
    },
    "@/domains/client-portal/notify.service": {
      deliverClientNotificationJob: async (_payload: unknown, jobKey: string) => {
        executions.push(`notification:${jobKey}`);
        notificationAttempts += 1;
        if (options?.failNotification || (options?.failFirstNotification && notificationAttempts === 1)) {
          throw new Error("PROVIDER\nTEMPORARILY_UNAVAILABLE");
        }
      },
    },
  });

  const addJob = (input: Partial<Job> & Pick<Job, "jobKey" | "type" | "payload">) => {
    const job: Job = {
      id: `job-${jobs.length + 1}`,
      status: "PENDING",
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: base,
      lockedAt: null,
      lastError: null,
      completedAt: null,
      companyId: "company-a",
      createdAt: base,
      updatedAt: base,
      ...input,
    };
    jobs.push(job);
    return job;
  };

  return {
    service,
    jobs,
    executions,
    base,
    prisma,
    addJob,
    firstDispatchStarted,
    releaseFirstDispatch: () => releaseFirstDispatch?.(),
  };
}

test("deux producteurs enregistrent une seule tâche durable", async () => {
  const f = fixture();
  const input = {
    jobKey: "auto-dispatch:delivery-1",
    type: "AUTO_DISPATCH" as const,
    payload: { companyId: "company-a", deliveryId: "delivery-1" },
    companyId: "company-a",
  };
  const first = await f.service.enqueueOperationJob(f.prisma as never, input);
  const replay = await f.service.enqueueOperationJob(f.prisma as never, input);
  assert.equal(first.id, replay.id);
  assert.equal(f.jobs.length, 1);
});

test("une tâche interrompue est reprise après expiration du verrou, une seule fois", async () => {
  const f = fixture();
  const job = f.addJob({
    jobKey: "auto-dispatch:delivery-2",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-2" },
    status: "PROCESSING",
    lockedAt: new Date(f.base.getTime() - 6 * 60_000),
  });

  const result = await f.service.processOperationJob(job.id, f.base);
  await f.service.processOperationJob(job.id, f.base);

  assert.equal(result?.status, "SUCCEEDED");
  assert.deepEqual(f.executions, ["dispatch:delivery-2"]);
  assert.equal(f.jobs[0]?.attempts, 1);
});

test("deux workers concurrents ne produisent qu'un effet", async () => {
  const f = fixture();
  const job = f.addJob({
    jobKey: "auto-dispatch:delivery-3",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-3" },
  });

  await Promise.all([
    f.service.processOperationJob(job.id, f.base),
    f.service.processOperationJob(job.id, f.base),
  ]);

  assert.deepEqual(f.executions, ["dispatch:delivery-3"]);
  assert.equal(f.jobs[0]?.status, "SUCCEEDED");
});

test("deux passages du filet cron qui se chevauchent n'exécutent chaque tâche qu'une fois", async () => {
  const f = fixture();
  for (const n of [1, 2, 3]) {
    f.addJob({
      jobKey: `auto-dispatch:delivery-cron-${n}`,
      type: "AUTO_DISPATCH",
      payload: { companyId: "company-a", deliveryId: `delivery-cron-${n}` },
    });
  }
  const [a, b] = await Promise.all([
    f.service.processDueOperationJobs(f.base),
    f.service.processDueOperationJobs(f.base),
  ]);
  assert.equal(f.executions.length, 3);
  assert.equal(new Set(f.executions).size, 3);
  assert.equal(a.succeeded + b.succeeded, 3);
  assert.ok(f.jobs.every((job) => job.status === "SUCCEEDED" && job.attempts === 1));
  const idle = await f.service.processDueOperationJobs(f.base);
  assert.equal(idle.processed, 0);
});

test("le filet cron signale les tâches PENDING en retard de plus de 15 minutes", async () => {
  const f = fixture({ failNotification: true });
  f.addJob({
    jobKey: "notification:delivery-late:DELIVERED",
    type: "CLIENT_NOTIFICATION",
    payload: { deliveryId: "delivery-late" },
    nextAttemptAt: new Date(f.base.getTime() - 20 * 60_000),
  });
  f.addJob({
    jobKey: "auto-dispatch:delivery-fresh",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-fresh" },
    nextAttemptAt: new Date(f.base.getTime() + 60_000),
  });
  const result = await f.service.processDueOperationJobs(f.base);
  // La tâche en échec est replanifiée dans le futur : elle n'est plus en retard.
  assert.equal(result.overdue, 0);
  const late = f.addJob({
    jobKey: "auto-dispatch:delivery-stuck",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-stuck" },
    nextAttemptAt: new Date(f.base.getTime() - 20 * 60_000),
    status: "PROCESSING",
    lockedAt: f.base,
  });
  assert.ok(late);
  assert.equal(await f.service.countOverduePendingJobs(f.base), 0);
  f.jobs[f.jobs.length - 1]!.status = "PENDING";
  f.jobs[f.jobs.length - 1]!.lockedAt = null;
  assert.equal(await f.service.countOverduePendingJobs(f.base), 1);
});

test("le retard compte aussi les tâches PROCESSING dont le bail a expiré sans reprise", async () => {
  const f = fixture();
  f.addJob({
    jobKey: "auto-dispatch:delivery-frozen",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-frozen" },
    status: "PROCESSING",
    lockedAt: new Date(f.base.getTime() - 30 * 60_000),
  });
  f.addJob({
    jobKey: "auto-dispatch:delivery-running",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-running" },
    status: "PROCESSING",
    lockedAt: new Date(f.base.getTime() - 60_000),
  });
  assert.equal(await f.service.countOverduePendingJobs(f.base), 1);
});

test("trois échecs bornés deviennent visibles sans boucle infinie", async () => {
  const f = fixture({ failNotification: true });
  const job = f.addJob({
    jobKey: "notification:delivery-4:DELIVERED",
    type: "CLIENT_NOTIFICATION",
    payload: { kind: "DELIVERY_STATUS", companyId: "company-a" },
  });

  await f.service.processOperationJob(job.id, f.base);
  await f.service.processOperationJob(job.id, new Date(f.base.getTime() + 2 * 60_000));
  await f.service.processOperationJob(job.id, new Date(f.base.getTime() + 8 * 60_000));
  await f.service.processOperationJob(job.id, new Date(f.base.getTime() + 60 * 60_000));

  const health = await f.service.getOperationJobHealth("company-a");
  assert.equal(f.jobs[0]?.status, "FAILED");
  assert.equal(f.jobs[0]?.attempts, 3);
  assert.equal(f.executions.length, 3);
  assert.equal(health.failed, 1);
  assert.equal(health.failedJobs[0]?.lastError, "PROVIDER TEMPORARILY_UNAVAILABLE");
});

test("une panne de notification est visible puis reprise avec la même clé", async () => {
  const f = fixture({ failFirstNotification: true });
  const job = f.addJob({
    jobKey: "client-notification:delivery:delivery-retry:event-1",
    type: "CLIENT_NOTIFICATION",
    payload: { kind: "DELIVERY_STATUS", companyId: "company-a" },
  });

  const failed = await f.service.processOperationJob(job.id, f.base);
  assert.equal(failed?.status, "PENDING");
  assert.equal(failed?.lastError, "PROVIDER TEMPORARILY_UNAVAILABLE");
  const recovered = await f.service.processOperationJob(
    job.id,
    new Date(f.base.getTime() + 2 * 60_000)
  );

  assert.equal(recovered?.status, "SUCCEEDED");
  assert.equal(f.jobs[0]?.attempts, 2);
  assert.deepEqual(f.executions, [
    "notification:client-notification:delivery:delivery-retry:event-1",
    "notification:client-notification:delivery:delivery-retry:event-1",
  ]);
});

test("une interruption après la dernière tentative devient un échec visible sans quatrième essai", async () => {
  const f = fixture();
  const job = f.addJob({
    jobKey: "auto-dispatch:delivery-max",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-max" },
    status: "PROCESSING",
    attempts: 3,
    maxAttempts: 3,
    lockedAt: new Date(f.base.getTime() - 6 * 60_000),
  });

  await f.service.processOperationJob(job.id, f.base);
  await f.service.processOperationJob(job.id, new Date(f.base.getTime() + 60 * 60_000));

  assert.equal(f.jobs[0]?.status, "FAILED");
  assert.equal(f.jobs[0]?.attempts, 3);
  assert.deepEqual(f.executions, []);
});

test("un worker expiré ne peut pas écraser le succès de sa reprise", async () => {
  const f = fixture({ slowFirstDispatchFailure: true });
  const job = f.addJob({
    jobKey: "auto-dispatch:delivery-fencing",
    type: "AUTO_DISPATCH",
    payload: { companyId: "company-a", deliveryId: "delivery-fencing" },
  });

  const expiredWorker = f.service.processOperationJob(job.id, f.base);
  await f.firstDispatchStarted;
  const recovery = await f.service.processOperationJob(
    job.id,
    new Date(f.base.getTime() + 6 * 60_000)
  );
  f.releaseFirstDispatch();
  await expiredWorker;

  assert.equal(recovery?.status, "SUCCEEDED");
  assert.equal(f.jobs[0]?.status, "SUCCEEDED");
  assert.equal(f.jobs[0]?.attempts, 2);
  assert.equal(f.jobs[0]?.lastError, null);
});
