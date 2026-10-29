import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Manifeste écrit par `npm run e2e:test-data -- seed` (sur tutelliv-dev uniquement). Absent : les specs concernées sautent. */
export type E2eTestData = {
  companies: { a: string; b: string; template: string };
  invoices: {
    a: { overdue: string; pending: string; paid: string; orderId: string };
    b: { overdue: string; pending: string; orderId: string };
  };
  deliveries: {
    delivered: { id: string; reference: string; recipientName: string };
    inDelivery: { id: string; reference: string };
  };
};

export const MISSING_TEST_DATA = "données de test absentes : npm run e2e:test-data -- seed (après npm run e2e:role-accounts -- setup)";

export function readTestData(): E2eTestData | null {
  try {
    return JSON.parse(readFileSync(resolve("outputs/e2e-test-data.json"), "utf8")) as E2eTestData;
  } catch {
    return null;
  }
}
