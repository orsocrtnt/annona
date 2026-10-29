import { jobEmailContentFreezer, jobEmailReplayWindow } from "../../src/domains/operations/operation-job.service";
import { sendTransactionalEmail, type TransactionalEmailInput } from "../../src/lib/email/transactional-email";

/**
 * Payloads de tâches en mémoire, au comportement des requêtes SQL de `jobEmailReplayWindow`
 * (clé emailFirstAttemptAt) et de `jobEmailContentFreezer` (clé emailSnapshot, jsonb).
 */
export function jobPayloadDb() {
  const payloads = new Map<string, Record<string, unknown>>();
  const keyOf = (strings: TemplateStringsArray) => (strings.join("?").includes("emailSnapshot") ? "emailSnapshot" : "emailFirstAttemptAt");
  const db = {
    $executeRaw: async (strings: TemplateStringsArray, value: string, id?: string) => {
      if (strings.join("?").includes("- 'emailSnapshot'")) {
        const payload = { ...(payloads.get(value) ?? {}) };
        delete payload.emailSnapshot;
        payloads.set(value, payload);
        return 1;
      }
      id = id!;
      const key = keyOf(strings);
      const payload = payloads.get(id) ?? {};
      if (key in payload) return 0;
      payloads.set(id, { ...payload, [key]: key === "emailSnapshot" ? JSON.parse(value) : value });
      return 1;
    },
    $queryRaw: async (strings: TemplateStringsArray, id: string) => {
      const key = keyOf(strings);
      const value = payloads.get(id)?.[key] ?? null;
      return [key === "emailSnapshot" ? { snapshot: value } : { first: value }];
    },
  };
  const windowFor = (job: { id: string; createdAt: Date; previouslyAttempted: boolean }) => jobEmailReplayWindow(job, db as never);
  const freezerFor = (jobId: string) => jobEmailContentFreezer(jobId, db as never);
  return { payloads, windowFor, freezerFor };
}

/** Vrai helper d'envoi, fournisseur simulé qui accepte et compte les appels. */
export function countingSender(now: Date) {
  const fetches: string[] = [];
  const bodies: string[] = [];
  const env = { EMAIL_DELIVERY_MODE: "live", RESEND_API_KEY: "test-key", MAIL_FROM: "TutelLiv <no-reply@example.test>" };
  const send = (input: TransactionalEmailInput) => sendTransactionalEmail(input, {
    env, now,
    fetcher: async (_url, init) => {
      fetches.push((init?.headers as Record<string, string>)["Idempotency-Key"]!);
      bodies.push(String(init?.body));
      return { ok: true, status: 200 };
    },
  });
  return { fetches, bodies, send };
}
