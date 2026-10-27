import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

/**
 * Remboursement décidé par un opérateur plateforme (SAAS-01B). Sans --apply, rien n'est envoyé.
 * La demande est journalisée dans saas_billing_operations (opérateur, motif, montant) et sa clé
 * dérive de son contenu : relancer la même commande ne rembourse jamais deux fois.
 *
 *   npm run billing:refund -- --invoice in_… --amount 1000 --operator ops@tutelliv.fr --reason "Erreur de facturation constatée"
 */
export type RefundRequest = { invoiceId: string; amountCents: number; operatorEmail: string; reason: string; apply: boolean };

function option(argv: string[], name: string) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]?.trim() : undefined;
}

export function parseRefundArgs(argv: string[]): RefundRequest {
  const invoiceId = option(argv, "invoice") ?? "";
  const amount = option(argv, "amount") ?? "";
  const operatorEmail = (option(argv, "operator") ?? "").toLowerCase();
  const reason = option(argv, "reason") ?? "";
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) throw new Error("REFUND_INVOICE_INVALID");
  if (!/^[1-9][0-9]{0,7}$/.test(amount)) throw new Error("REFUND_AMOUNT_INVALID");
  if (!/^[^@\s]+@[^@\s]+$/.test(operatorEmail)) throw new Error("REFUND_OPERATOR_INVALID");
  if (reason.length < 10 || reason.length > 500) throw new Error("REFUND_REASON_INVALID");
  return { invoiceId, amountCents: Number(amount), operatorEmail, reason, apply: argv.includes("--apply") };
}

export function refundRequestKey(request: Omit<RefundRequest, "apply">) {
  const digest = createHash("sha256").update(JSON.stringify([request.invoiceId, request.amountCents, request.operatorEmail, request.reason])).digest("hex");
  return `refund:${request.invoiceId}:${digest.slice(0, 24)}`;
}

async function main() {
  const request = parseRefundArgs(process.argv.slice(2));
  const { prisma } = await import("../../src/services/prisma/client");
  const { sandboxBilling } = await import("../../src/domains/billing/billing.service");
  try {
    const operator = await prisma.user.findFirst({ where: { email: request.operatorEmail, status: "ACTIVE", role: { systemRole: "SUPER_ADMIN" } }, select: { id: true } });
    if (!operator) throw new Error("REFUND_OPERATOR_NOT_PLATFORM_ADMIN");
    const accounts = await prisma.saasBillingAccount.findMany({ where: { state: { path: ["invoices"], array_contains: [{ id: request.invoiceId }] } }, select: { id: true, state: true } });
    if (accounts.length !== 1) throw new Error("REFUND_INVOICE_UNKNOWN");
    const invoice = (accounts[0]!.state as { invoices: Array<{ id: string; status: string; paidCents: number; refundedCents: number }> }).invoices.find((item) => item.id === request.invoiceId)!;
    const refundable = invoice.paidCents - invoice.refundedCents;
    const key = refundRequestKey(request);
    console.log(JSON.stringify({ mode: request.apply ? "apply" : "dry-run", invoiceId: invoice.id, status: invoice.status, paidCents: invoice.paidCents, refundedCents: invoice.refundedCents, refundableCents: refundable, amountCents: request.amountCents, key }));
    if (!request.apply) { console.log("Dry-run. Relancer avec --apply pour rembourser."); return; }
    const billing = sandboxBilling();
    const result = await billing.command(accounts[0]!.id, key, { kind: "REFUND", invoiceId: request.invoiceId, amountCents: request.amountCents, reason: request.reason, actorId: operator.id });
    await billing.reconcile(accounts[0]!.id).catch(() => null);
    const after = await prisma.saasBillingAccount.findUniqueOrThrow({ where: { id: accounts[0]!.id }, select: { state: true } });
    const updated = (after.state as { invoices: Array<{ id: string; refundedCents: number }> }).invoices.find((item) => item.id === request.invoiceId);
    console.log(JSON.stringify({ refunded: true, result, refundedCentsAfter: updated?.refundedCents ?? null }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "REFUND_FAILED"); process.exitCode = 1; });
}
