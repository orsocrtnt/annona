import { jobEmailReplayWindow } from "../../src/domains/operations/operation-job.service";
import { sendTransactionalEmail, type TransactionalEmailInput } from "../../src/lib/email/transactional-email";

/** Payloads de tâches en mémoire, au comportement des deux requêtes SQL de `jobEmailReplayWindow`. */
export function jobPayloadDb() {
  const payloads = new Map<string, Record<string, unknown>>();
  const db = {
    $executeRaw: async (_strings: TemplateStringsArray, marker: string, id: string) => {
      const payload = payloads.get(id) ?? {};
      if ("emailFirstAttemptAt" in payload) return 0;
      payloads.set(id, { ...payload, emailFirstAttemptAt: marker });
      return 1;
    },
    $queryRaw: async (_strings: TemplateStringsArray, id: string) => [{ first: (payloads.get(id)?.emailFirstAttemptAt as string | undefined) ?? null }],
  };
  const windowFor = (job: { id: string; createdAt: Date; previouslyAttempted: boolean }) => jobEmailReplayWindow(job, db as never);
  return { payloads, windowFor };
}

/** Vrai helper d'envoi, fournisseur simulé qui accepte et compte les appels. */
export function countingSender(now: Date) {
  const fetches: string[] = [];
  const env = { EMAIL_DELIVERY_MODE: "live", RESEND_API_KEY: "test-key", MAIL_FROM: "TutelLiv <no-reply@example.test>" };
  const send = (input: TransactionalEmailInput) => sendTransactionalEmail(input, {
    env, now,
    fetcher: async (_url, init) => {
      fetches.push((init?.headers as Record<string, string>)["Idempotency-Key"]!);
      return { ok: true, status: 200 };
    },
  });
  return { fetches, send };
}
