import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { activateSignupJourney, type SignupCatalog, type SignupOptionSelection } from "@/domains/signup/signup.service";
import { snapshotPlan } from "@/domains/saas/saas.service";
import { changeTiming, initialBillingState, makeBillingContract, monthlyUsageAmount, reconcileBilling, reminderDays, type BillingContract, type BillingState } from "./billing-core";
import { StripeSandboxProvider, type SandboxBillingProvider } from "./stripe-sandbox";

type Db = typeof prisma;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const stateOf = (value: Prisma.JsonValue) => value as unknown as BillingState;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function keyFor(accountId: string, key: string) { return createHash("sha256").update(`${accountId}:${key}`).digest("hex"); }
function object(value: unknown): Record<string, Prisma.JsonValue> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {}; }
export type BillingCommand =
  | { kind: "CHECKOUT"; email: string }
  | { kind: "CHANGE"; target: BillingContract; prorationDate: number; confirmedTotalCents: number; actorId: string }
  | { kind: "CANCEL"; actorId: string }
  | { kind: "REFUND"; invoiceId: string; amountCents: number; reason: string; actorId: string }
  | { kind: "USAGE"; periodId: string; amountHtCents: number; start: string; end: string };

/** Lock locally, call provider outside transactions, then finish atomically. A timed-out POST keeps its original key. */
export class BillingService {
  constructor(private readonly provider: SandboxBillingProvider, private readonly db: Db = prisma) {}
  async accountForSignup(token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return this.db.$transaction(async (tx) => {
      const found = await tx.signupJourney.findUnique({ where: { resumeTokenHash: tokenHash } });
      if (!found) throw new Error("SIGNUP_RESUME_INVALID");
      await tx.$queryRaw`SELECT id FROM signup_journeys WHERE id = ${found.id} FOR UPDATE`;
      const journey = await tx.signupJourney.findUniqueOrThrow({ where: { id: found.id }, include: { catalogVersion: { include: { plans: true, options: true } } } });
      if (!journey.emailVerifiedAt || !journey.email || journey.expiresAt <= new Date()) throw new Error("SIGNUP_EMAIL_UNVERIFIED");
      const existing = await tx.saasBillingAccount.findUnique({ where: { signupId: journey.id } });
      if (existing) return existing;
      if (journey.paymentConfirmedAt || journey.companyId) throw new Error("BILLING_ALREADY_ACTIVATED");
      const contract = makeBillingContract(journey.catalogVersion as unknown as SignupCatalog, journey.planCode, journey.billingInterval, journey.optionSelections as unknown as SignupOptionSelection[]);
      await tx.signupJourney.update({ where: { id: journey.id }, data: { status: "PAYMENT_PENDING", failureCode: "STRIPE_CHECKOUT_LOCKED" } });
      return tx.saasBillingAccount.create({ data: { signupId: journey.id, state: json(initialBillingState(contract)) } });
    });
  }
  async checkout(token: string) {
    const account = await this.accountForSignup(token);
    const journey = await this.db.signupJourney.findUniqueOrThrow({ where: { id: account.signupId } });
    let requestKey = "checkout-v1";
    if (account.checkoutId) {
      try {
        await this.provider.checkoutSubscription(account.checkoutId);
        const current = await this.db.saasBillingOperation.findFirstOrThrow({ where: { accountId: account.id, kind: "CHECKOUT", status: "DONE", result: { path: ["id"], equals: account.checkoutId } } });
        await this.reconcile(account.id);
        return object(current.result);
      }
      catch (error) {
        if (!(error instanceof Error) || error.message !== "BILLING_CHECKOUT_EXPIRED") throw error;
        requestKey = `checkout-replacement:${account.checkoutId}`;
      }
    }
    const result = await this.command(account.id, requestKey, { kind: "CHECKOUT", email: journey.email! });
    await this.reconcile(account.id);
    return result;
  }
  async command(accountId: string, requestKey: string, input: BillingCommand) {
    if (!requestKey || requestKey.length > 160) throw new Error("BILLING_KEY_INVALID");
    const operationId = keyFor(accountId, requestKey);
    const prepared = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM saas_billing_accounts WHERE id = ${accountId} FOR UPDATE`;
      const account = await tx.saasBillingAccount.findUniqueOrThrow({ where: { id: accountId } });
      const existing = await tx.saasBillingOperation.findUnique({ where: { id: operationId } });
      if (existing) {
        if (canonical(object(existing.input).command) !== canonical(json(input))) throw new Error("BILLING_KEY_REUSED");
        return { account, operation: existing };
      }
      if (account.pendingOperationId) throw new Error("BILLING_CHANGE_CONCURRENT");
      const state = stateOf(account.state);
      if (input.kind !== "CHECKOUT" && (!account.providerSubscriptionId || !state.activeContract)) throw new Error("BILLING_NOT_ACTIVE");
      if (input.kind === "CHANGE" && (state.pendingChange || state.cancelAtPeriodEnd || state.status !== "ACTIVE")) throw new Error("BILLING_CHANGE_CONFLICT");
      if (input.kind === "CHANGE") {
        if (!input.actorId || !Number.isSafeInteger(input.prorationDate) || Math.abs(Date.now() / 1000 - input.prorationDate) > 900) throw new Error("BILLING_CONSENT_EXPIRED");
        await this.assertSeatsFit(tx, account.subscriptionId, input.target);
      }
      if (input.kind === "REFUND") {
        const invoice = state.invoices.find((i) => i.id === input.invoiceId);
        if (!input.actorId || input.reason.trim().length < 10 || !Number.isInteger(input.amountCents) || input.amountCents < 1 || !invoice || input.amountCents > invoice.paidCents - invoice.refundedCents) throw new Error("BILLING_REFUND_INVALID");
      }
      if (input.kind === "USAGE") {
        await tx.$queryRaw`SELECT id FROM saas_usage_periods WHERE id = ${input.periodId} FOR UPDATE`;
        const period = await tx.saasUsagePeriod.findUniqueOrThrow({ where: { id: input.periodId } });
        if (period.subscriptionId !== account.subscriptionId || period.closedAt || monthlyUsageAmount(period, new Date()) !== input.amountHtCents || period.startsAt.toISOString() !== input.start || period.endsAt.toISOString() !== input.end) throw new Error("BILLING_USAGE_MISMATCH");
      }
      const operation = await tx.saasBillingOperation.create({ data: { id: operationId, accountId, kind: input.kind, input: json({ requestKey, command: input }) } });
      await tx.saasBillingAccount.update({ where: { id: accountId }, data: { pendingOperationId: operationId, revision: { increment: 1 } } });
      return { account, operation };
    });
    if (prepared.operation.status === "DONE") return object(prepared.operation.result);
    if (prepared.operation.status === "REJECTED") throw new Error("BILLING_CONSENT_AMOUNT_CHANGED");
    // A provider may discard idempotency keys after 24h. Do not blindly replay an older uncertain charge.
    if (Date.now() - prepared.operation.createdAt.getTime() >= 23 * 3_600_000) throw new Error("BILLING_MANUAL_RECONCILIATION_REQUIRED");
    await this.db.saasBillingOperation.update({ where: { id: operationId }, data: { attempts: { increment: 1 } } });
    const state = stateOf(prepared.account.state);
    const sub = prepared.account.providerSubscriptionId!;
    let result: object;
    switch (input.kind) {
      case "CHECKOUT": result = await this.provider.checkout(accountId, input.email, state.contract, operationId); break;
      case "CHANGE": {
        const timing = changeTiming(state.activeContract!, input.target);
        if (timing === "renewal") result = { ...await this.provider.schedule(sub, input.target, operationId), timing };
        else {
          if (!object(prepared.operation.result).consentVerified) {
            const preview = await this.provider.previewChange(sub, input.target, operationId, input.prorationDate);
            if (preview.currency !== "EUR" || preview.totalCents !== input.confirmedTotalCents) {
              await this.db.$transaction([
                this.db.saasBillingOperation.update({ where: { id: operationId }, data: { status: "REJECTED" } }),
                this.db.saasBillingAccount.updateMany({ where: { id: accountId, pendingOperationId: operationId }, data: { pendingOperationId: null, revision: { increment: 1 } } }),
              ]);
              throw new Error("BILLING_CONSENT_AMOUNT_CHANGED");
            }
            await this.db.saasBillingOperation.update({ where: { id: operationId }, data: { result: { consentVerified: true, totalCents: preview.totalCents, currency: preview.currency } } });
          }
          result = { ...await this.provider.change(sub, input.target, operationId, input.prorationDate), timing };
        }
        break;
      }
      case "CANCEL": result = await this.provider.cancel(sub, operationId); break;
      case "REFUND": result = await this.provider.refund(input.invoiceId, input.amountCents, operationId); break;
      case "USAGE": result = input.amountHtCents === 0 ? { invoiceId: null } : await this.provider.usage(accountId, sub, input.amountHtCents, state.activeContract!.quote.vatRateBps, { start: input.start, end: input.end }, operationId); break;
    }
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM saas_billing_accounts WHERE id = ${accountId} FOR UPDATE`;
      const account = await tx.saasBillingAccount.findUniqueOrThrow({ where: { id: accountId } });
      const operation = await tx.saasBillingOperation.findUniqueOrThrow({ where: { id: operationId } });
      if (operation.status === "DONE") return;
      const updatedState = stateOf(account.state);
      const data = object(json(result));
      if (input.kind === "CHANGE") updatedState.pendingChange = { contract: input.target, invoiceId: typeof data.invoiceId === "string" ? data.invoiceId : null, atRenewal: data.timing === "renewal", expectedTotalCents: input.confirmedTotalCents };
      if (input.kind === "CANCEL") updatedState.pendingChange = null;
      if (input.kind === "USAGE") await tx.saasUsagePeriod.update({ where: { id: input.periodId }, data: { closedAt: new Date() } });
      await tx.saasBillingOperation.update({ where: { id: operationId }, data: { status: "DONE", result: json(result), completedAt: new Date() } });
      await tx.saasBillingAccount.update({ where: { id: accountId }, data: { pendingOperationId: null, revision: { increment: 1 }, state: json(updatedState), ...(input.kind === "CHECKOUT" ? { checkoutId: String(data.id), providerCustomerId: String(data.customerId) } : {}) } });
    });
    return object(json(result));
  }
  async preview(accountId: string, target: BillingContract, prorationDate: number) {
    const account = await this.db.saasBillingAccount.findUniqueOrThrow({ where: { id: accountId } });
    const state = stateOf(account.state);
    if (!state.activeContract || !account.providerSubscriptionId || state.pendingChange || state.cancelAtPeriodEnd) throw new Error("BILLING_CHANGE_CONFLICT");
    const timing = changeTiming(state.activeContract, target);
    return timing === "renewal" ? { totalCents: 0, currency: "EUR", timing, prorationDate } : { ...await this.provider.previewChange(account.providerSubscriptionId, target, `preview:${target.hash}`, prorationDate), timing, prorationDate };
  }
  async reconcile(accountId: string, eventId?: string, now = new Date()) {
    for (let retry = 0; retry < 4; retry++) {
      const account = await this.db.saasBillingAccount.findUniqueOrThrow({ where: { id: accountId } });
      let sub = account.providerSubscriptionId;
      if (!sub && account.checkoutId) {
        try { sub = await this.provider.checkoutSubscription(account.checkoutId); }
        catch (error) {
          if (error instanceof Error && error.message === "BILLING_CHECKOUT_EXPIRED") return stateOf(account.state);
          throw error;
        }
      }
      if (!sub) return stateOf(account.state);
      const snapshot = await this.provider.snapshot(sub, account.id);
      if (account.providerCustomerId && snapshot.customerId !== account.providerCustomerId) throw new Error("BILLING_TENANT_MISMATCH");
      const next = reconcileBilling(stateOf(account.state), snapshot, now);
      const saved = await this.db.$transaction(async (tx) => {
        const changed = await tx.saasBillingAccount.updateMany({ where: { id: accountId, revision: account.revision }, data: { state: json(next), providerSubscriptionId: sub, providerCustomerId: snapshot.customerId, revision: { increment: 1 } } });
        if (!changed.count) return false;
        if (eventId) await tx.saasBillingOperation.upsert({ where: { id: `event:${eventId}` }, create: { id: `event:${eventId}`, accountId, kind: "EVENT", input: { eventId }, status: "DONE", completedAt: new Date() }, update: {} });
        if (next.activeContract) {
          const invoice = next.invoices.find((i) => i.reason === "subscription_create" && i.status === "paid");
          if (!invoice) throw new Error("BILLING_INITIAL_INVOICE_MISSING");
          await tx.signupPaymentEvent.upsert({ where: { eventKey: `stripe:${invoice.id}` }, create: { eventKey: `stripe:${invoice.id}`, signupId: account.signupId, status: "CONFIRMED", amountCents: invoice.totalCents, currency: "EUR", snapshot: json({ adapter: "stripe-sandbox", invoice, providerSubscriptionId: sub, providerCustomerId: snapshot.customerId }) }, update: {} });
          await tx.signupJourney.updateMany({ where: { id: account.signupId, paymentConfirmedAt: null }, data: { status: "PAYMENT_CONFIRMED", paymentConfirmedAt: new Date(), failureCode: null } });
        }
        if (next.failedAt) for (const day of reminderDays(next.failedAt, new Date())) {
          const id = keyFor(accountId, `arrears:${next.failedAt}:${day}`);
          await tx.saasBillingOperation.upsert({ where: { id }, create: { id, accountId, kind: "REMINDER_DUE", input: { day, failedAt: next.failedAt }, status: "PENDING_DELIVERY" }, update: {} });
        }
        return true;
      });
      if (!saved) continue;
      if (next.activeContract) {
        // If provisioning fails, payment is durable and the next sweep resumes this exact activation.
        const activation = await activateSignupJourney(account.signupId);
        await this.project(accountId, activation.companyId);
      }
      return next;
    }
    throw new Error("BILLING_RECONCILIATION_CONCURRENT");
  }
  private async assertSeatsFit(tx: Prisma.TransactionClient, subscriptionId: string | null, contract: BillingContract) {
    if (!subscriptionId) return;
    const subscription = await tx.saasSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const plan = contract.catalog.plans.find((p) => p.code === contract.quote.planCode)!;
    const limits = { DRIVER: plan.includedDriverSeats, COMPANY_ADMIN: plan.includedAdminSeats, DISPATCHER: plan.includedDispatcherSeats };
    for (const selection of contract.quote.selections) {
      const option = contract.catalog.options.find((o) => o.code === selection.code)!;
      if (option.kind === "DRIVER_SEAT") limits.DRIVER += selection.quantity;
      if (option.kind === "ADMIN_SEAT") limits.COMPANY_ADMIN += selection.quantity;
      if (option.kind === "DISPATCHER_SEAT") limits.DISPATCHER += selection.quantity;
    }
    for (const [role, limit] of Object.entries(limits)) {
      const count = await tx.user.count({ where: { companyId: subscription.companyId, status: { in: ["ACTIVE", "PENDING_VERIFICATION"] }, role: { systemRole: role as "DRIVER" | "COMPANY_ADMIN" | "DISPATCHER" } } });
      const reservations = await tx.saasSeatReservation.count({ where: { companyId: subscription.companyId, role: role as "DRIVER" | "COMPANY_ADMIN" | "DISPATCHER", expiresAt: { gt: new Date() } } });
      if (count + reservations > limit) throw new Error("BILLING_DOWNGRADE_SEATS_EXCEEDED");
    }
  }
  private async project(accountId: string, companyId: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM saas_billing_accounts WHERE id = ${accountId} FOR UPDATE`;
      const account = await tx.saasBillingAccount.findUniqueOrThrow({ where: { id: accountId } });
      const state = stateOf(account.state), contract = state.activeContract!;
      const subscription = await tx.saasSubscription.findUniqueOrThrow({ where: { companyId } });
      await tx.$queryRaw`SELECT id FROM saas_subscriptions WHERE id = ${subscription.id} FOR UPDATE`;
      const previous = object(subscription.snapshot);
      if (previous.billingContractHash !== contract.hash) {
        await this.assertSeatsFit(tx, subscription.id, contract);
        const plan = await tx.saasPlan.findUniqueOrThrow({ where: { catalogVersionId_code: { catalogVersionId: contract.catalog.id, code: contract.quote.planCode } } });
        const now = new Date();
        await tx.saasPlanAssignment.updateMany({ where: { subscriptionId: subscription.id, effectiveTo: null }, data: { effectiveTo: now } });
        await tx.saasPlanAssignment.create({ data: { subscriptionId: subscription.id, planId: plan.id, effectiveFrom: now, snapshot: snapshotPlan(plan) } });
        const oldItems = await tx.saasSubscriptionItem.findMany({ where: { subscriptionId: subscription.id, effectiveTo: null } });
        await tx.saasSubscriptionItem.updateMany({ where: { subscriptionId: subscription.id, effectiveTo: null }, data: { effectiveTo: now } });
        for (const selection of contract.quote.selections) {
          const option = contract.catalog.options.find((o) => o.code === selection.code)!;
          const line = contract.lines.find((l) => l.code === selection.code)!;
          const old = oldItems.find((item) => item.code === option.code);
          await tx.saasSubscriptionItem.create({ data: { subscriptionId: subscription.id, optionId: option.id, code: option.code, kind: option.kind, source: old?.source ?? "ADDED_LATER", quantity: selection.quantity, unitPriceCents: line.unitHtCents, effectiveFrom: now, snapshot: json({ schemaVersion: 1, featureKey: option.featureKey, optionCode: option.code, billingInterval: contract.quote.billingInterval, unitPriceCents: line.unitHtCents }) } });
        }
      }
      await tx.saasSubscription.update({ where: { id: subscription.id }, data: { status: state.status, billingInterval: contract.quote.billingInterval, catalogVersionId: contract.catalog.id, providerSubscriptionId: account.providerSubscriptionId, providerCustomerId: account.providerCustomerId, currentPeriodStart: new Date(state.periodStart!), currentPeriodEnd: new Date(state.periodEnd!), cancelAtPeriodEnd: state.cancelAtPeriodEnd, endedAt: state.status === "CANCELLED" ? new Date(state.periodEnd!) : null, snapshot: json({ ...previous, billingContractHash: contract.hash, billingFailedAt: state.failedAt, billingAccountId: accountId, quote: contract.quote }) } });
      await tx.saasBillingAccount.update({ where: { id: accountId }, data: { subscriptionId: subscription.id } });
    });
  }
  async billClosedUsage(accountId: string, now = new Date()) {
    const account = await this.db.saasBillingAccount.findUniqueOrThrow({ where: { id: accountId } });
    if (!account.subscriptionId) return;
    const periods = await this.db.saasUsagePeriod.findMany({ where: { subscriptionId: account.subscriptionId, endsAt: { lte: now }, closedAt: null }, orderBy: { startsAt: "asc" } });
    for (const period of periods) {
      const amount = monthlyUsageAmount(period, now);
      await this.command(accountId, `usage:${period.id}`, { kind: "USAGE", periodId: period.id, amountHtCents: amount, start: period.startsAt.toISOString(), end: period.endsAt.toISOString() });
    }
  }
  async sweep(limit = 25, afterId?: string) {
    const accounts = await this.db.saasBillingAccount.findMany({ orderBy: { id: "asc" }, take: limit, ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}) });
    let failed = 0;
    for (const account of accounts) {
      try {
        if (account.pendingOperationId) {
          const operation = await this.db.saasBillingOperation.findUniqueOrThrow({ where: { id: account.pendingOperationId } });
          // Replay by the persisted operation identity; do not invent a fresh provider key.
          await this.resumeOperation(operation.id);
        }
        await this.reconcile(account.id);
        await this.billClosedUsage(account.id);
      } catch { failed++; }
    }
    return { checked: accounts.length, failed, nextCursor: accounts.length === limit ? accounts[accounts.length - 1]!.id : null };
  }
  async resumeOperation(operationId: string) {
    const operation = await this.db.saasBillingOperation.findUniqueOrThrow({ where: { id: operationId } });
    const input = object(operation.input);
    // Original logical request key is persisted separately by the caller wrapper below.
    const requestKey = input.requestKey;
    if (typeof requestKey !== "string") throw new Error("BILLING_MANUAL_RECONCILIATION_REQUIRED");
    return this.command(operation.accountId, requestKey, input.command as unknown as BillingCommand);
  }
}
export function sandboxBilling() { return new BillingService(new StripeSandboxProvider()); }
