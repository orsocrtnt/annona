import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

/**
 * Remboursement décidé par un opérateur plateforme (SAAS-01B). Sans --apply, rien n'est envoyé.
 * La demande est journalisée dans saas_billing_operations (opérateur, motif, montant) et sa clé
 * dérive de son contenu : relancer la même commande ne rembourse jamais deux fois.
 *
 * L'opérateur est authentifié par TUTELLIV_OPERATOR_ACCESS_TOKEN, jamais par un e-mail CLI.
 *   npm run billing:refund -- --invoice in_… --amount 1000 --reason "Erreur de facturation constatée"
 */
export type RefundRequest = { invoiceId: string; amountCents: number; reason: string; apply: boolean };

function option(argv: string[], name: string) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1]?.trim() : undefined;
}

export function parseRefundArgs(argv: string[]): RefundRequest {
  const invoiceId = option(argv, "invoice") ?? "";
  const amount = option(argv, "amount") ?? "";
  const reason = option(argv, "reason") ?? "";
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) throw new Error("REFUND_INVOICE_INVALID");
  if (!/^[1-9][0-9]{0,7}$/.test(amount)) throw new Error("REFUND_AMOUNT_INVALID");
  if (reason.length < 10 || reason.length > 500) throw new Error("REFUND_REASON_INVALID");
  return { invoiceId, amountCents: Number(amount), reason, apply: argv.includes("--apply") };
}

export function refundRequestKey(request: Omit<RefundRequest, "apply">) {
  const digest = createHash("sha256").update(JSON.stringify([request.invoiceId, request.amountCents])).digest("hex");
  return `refund:${request.invoiceId}:${digest.slice(0, 24)}`;
}

async function main() {
  const request = parseRefundArgs(process.argv.slice(2));
    const { prisma } = await import("../../src/services/prisma/client");
    const { sandboxBilling } = await import("../../src/domains/billing/billing.service");
  try {
    const token = process.env.TUTELLIV_OPERATOR_ACCESS_TOKEN;
    if (!token) throw new Error("REFUND_OPERATOR_SESSION_REQUIRED");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws as never },
    });
    const identity = await supabase.auth.getUser(token);
    if (identity.error || !identity.data.user) throw new Error("REFUND_OPERATOR_SESSION_INVALID");
    const operator = await prisma.user.findFirst({ where: { authId: identity.data.user.id, status: "ACTIVE", role: { systemRole: "SUPER_ADMIN" } }, select: { id: true } });
    if (!operator) throw new Error("REFUND_OPERATOR_NOT_PLATFORM_ADMIN");
    const accounts = await prisma.saasBillingAccount.findMany({ where: { state: { path: ["invoices"], array_contains: [{ id: request.invoiceId }] } }, select: { id: true, state: true } });
    if (accounts.length !== 1) throw new Error("REFUND_INVOICE_UNKNOWN");
    const billing = sandboxBilling();
    await billing.reconcile(accounts[0]!.id);
    const reconciled = await prisma.saasBillingAccount.findUniqueOrThrow({ where: { id: accounts[0]!.id }, select: { state: true } });
    const invoice = (reconciled.state as { invoices: Array<{ id: string; status: string; paidCents: number; refundedCents: number }> }).invoices.find((item) => item.id === request.invoiceId)!;
    const refundable = invoice.paidCents - invoice.refundedCents;
    const key = refundRequestKey(request);
    console.log(JSON.stringify({ mode: request.apply ? "apply" : "dry-run", invoiceId: invoice.id, status: invoice.status, paidCents: invoice.paidCents, refundedCents: invoice.refundedCents, refundableCents: refundable, amountCents: request.amountCents, key }));
    if (!request.apply) { console.log("Dry-run. Relancer avec --apply pour rembourser."); return; }
    const result = await billing.command(accounts[0]!.id, key, { kind: "REFUND", invoiceId: request.invoiceId, amountCents: request.amountCents, reason: request.reason, actorId: operator.id });
    await billing.reconcile(accounts[0]!.id);
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
