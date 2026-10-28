import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { reconcileRevenue, type RevenueAccountInput } from "../../src/domains/billing/revenue-reconciliation";
import { StripeSandboxProvider } from "../../src/domains/billing/stripe-sandbox";
import { prisma } from "../../src/services/prisma/client";

// Rapprochement en lecture seule : lectures Prisma et GET fournisseur, aucune écriture.
async function run() {
  const [month, outputPath, ...extra] = process.argv.slice(2);
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !outputPath || extra.length) {
    throw new Error("SAAS02_USAGE: tsx scripts/saas02/reconcile.ts <AAAA-MM> <sortie.json>");
  }
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const period = { startsAt: new Date(Date.UTC(year, monthIndex - 1, 1)), endsAt: new Date(Date.UTC(year, monthIndex, 1)) };
  const provider = new StripeSandboxProvider();
  const accounts = await prisma.saasBillingAccount.findMany({
    where: { providerSubscriptionId: { not: null } },
    orderBy: { id: "asc" },
    select: { id: true, providerSubscriptionId: true, state: true },
  });
  const inputs: RevenueAccountInput[] = [];
  let unread = 0;
  for (const account of accounts) {
    const state = account.state as { invoices?: unknown[] } | null;
    try {
      const snapshot = await provider.snapshot(account.providerSubscriptionId!, account.id);
      inputs.push({ accountId: account.id, local: Array.isArray(state?.invoices) ? state.invoices : [], provider: snapshot.invoices });
    } catch {
      unread++;
    }
  }
  const result = reconcileRevenue(inputs, period, unread);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  const { discrepancies, ...summary } = result;
  console.log(JSON.stringify({ ...summary, discrepancies: discrepancies.length }));
}

void run().catch((error) => {
  // Les erreurs fournisseur ou Prisma peuvent contenir des informations de connexion.
  console.error(error instanceof Error && /^(SAAS02_|BILLING_)[A-Z_]+/.test(error.message) ? error.message : "SAAS02_RECONCILIATION_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
