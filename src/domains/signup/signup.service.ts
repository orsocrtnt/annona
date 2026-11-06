import { signupTestShortcutsAllowed } from "@/domains/signup/signup-availability";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, type SaasBillingInterval, type SaasPlanCode, type SignupPaymentStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { createAdminClient } from "@/services/supabase/admin";
import { createPasswordLinkClient } from "@/services/supabase/password-link";
import { getPasswordLinkRedirect } from "@/lib/auth/email-links";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { slugify } from "@/lib/utils";
import {
  premiumDiscoveryEndsAtForPaidSignup,
  snapshotPlan,
} from "@/domains/saas/saas.service";
import {
  enqueueOperationJob,
  kickOperationJob,
  skippedJobError,
} from "@/domains/operations/operation-job.service";
import { sendTransactionalEmail, type EmailContentFreezer, type ReplayWindowStart } from "@/lib/email/transactional-email";
import { attributeSignupSale, resolveActiveSalesCodeId } from "@/domains/sales/sales-code.service";

export const SIGNUP_COOKIE = "annona-signup-resume";
export const SIGNUP_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SIGNUP_EMAIL_RESEND_COOLDOWN_SECONDS = 30;

export type SignupOptionSelection = { code: string; quantity: number };

export type SignupCatalog = {
  id: string;
  code: string;
  currency: string;
  vatRateBps: number;
  plans: Array<{
    code: SaasPlanCode;
    name: string;
    monthlyPriceCents: number;
    annualPriceCents: number;
    includedDriverSeats: number;
    unlimitedDriverSeats: boolean;
    maxDriverSeats: number | null;
    includedAdminSeats: number;
    maxAdminSeats: number | null;
    includedDispatcherSeats: number;
    maxDispatcherSeats: number | null;
    includedMonthlyOrders: number;
    orderOverageUnitPriceCents: number;
    includedFeatures: string[];
  }>;
  options: Array<{
    id: string;
    code: string;
    name: string;
    kind: "OPTION" | "DRIVER_SEAT" | "ADMIN_SEAT" | "DISPATCHER_SEAT";
    featureKey: string | null;
    monthlyPriceCents: number;
    annualPriceCents: number;
    applicablePlans: SaasPlanCode[];
  }>;
};

export type SignupQuote = {
  schemaVersion: 1;
  catalogCode: string;
  planCode: SaasPlanCode;
  planName: string;
  billingInterval: SaasBillingInterval;
  currency: string;
  vatRateBps: number;
  planPriceCents: number;
  optionsPriceCents: number;
  totalHtCents: number;
  vatCents: number;
  totalTtcCents: number;
  includedMonthlyOrders: number;
  orderOverageUnitPriceCents: number;
  selections: SignupOptionSelection[];
};

export function nextSignupPaymentState(
  alreadyConfirmed: boolean,
  eventStatus: SignupPaymentStatus
): { status: "EMAIL_VERIFIED" | "PAYMENT_PENDING" | "PAYMENT_CONFIRMED"; failureCode: string | null; confirmsPayment: boolean } {
  if (alreadyConfirmed || eventStatus === "CONFIRMED") {
    return { status: "PAYMENT_CONFIRMED", failureCode: null, confirmsPayment: !alreadyConfirmed && eventStatus === "CONFIRMED" };
  }
  if (eventStatus === "DECLINED") {
    return { status: "EMAIL_VERIFIED", failureCode: "PAYMENT_DECLINED", confirmsPayment: false };
  }
  return { status: "PAYMENT_PENDING", failureCode: null, confirmsPayment: false };
}

export function signupQuoteMatches(current: SignupQuote, stored: SignupQuote) {
  return current.schemaVersion === stored.schemaVersion &&
    current.catalogCode === stored.catalogCode &&
    current.planCode === stored.planCode &&
    current.planName === stored.planName &&
    current.billingInterval === stored.billingInterval &&
    current.currency === stored.currency &&
    current.vatRateBps === stored.vatRateBps &&
    current.planPriceCents === stored.planPriceCents &&
    current.optionsPriceCents === stored.optionsPriceCents &&
    current.totalHtCents === stored.totalHtCents &&
    current.vatCents === stored.vatCents &&
    current.totalTtcCents === stored.totalTtcCents &&
    current.includedMonthlyOrders === stored.includedMonthlyOrders &&
    current.orderOverageUnitPriceCents === stored.orderOverageUnitPriceCents &&
    JSON.stringify(current.selections) === JSON.stringify(stored.selections);
}

type JourneyRecord = Awaited<ReturnType<typeof prisma.signupJourney.findUnique>>;

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function tokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function asSelections(value: Prisma.JsonValue | null | undefined): SignupOptionSelection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const code = "code" in item ? item.code : undefined;
    const quantity = "quantity" in item ? item.quantity : undefined;
    return typeof code === "string" && typeof quantity === "number" ? [{ code, quantity }] : [];
  });
}

function quoteFromJson(value: Prisma.JsonValue): SignupQuote {
  return value as unknown as SignupQuote;
}

function paymentAdapterFromSnapshot(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return typeof value.adapter === "string" ? value.adapter : null;
}

function publicJourney(journey: NonNullable<JourneyRecord>) {
  return {
    status: journey.status,
    planCode: journey.planCode,
    billingInterval: journey.billingInterval,
    optionSelections: asSelections(journey.optionSelections),
    quote: quoteFromJson(journey.quoteSnapshot),
    email: journey.email,
    firstName: journey.firstName,
    lastName: journey.lastName,
    companyName: journey.companyName,
    legalName: journey.legalName,
    siren: journey.siren,
    siret: journey.siret,
    phone: journey.phone,
    billingAddress: journey.billingAddress,
    billingPostalCode: journey.billingPostalCode,
    billingCity: journey.billingCity,
    billingCountry: journey.billingCountry,
    emailVerified: Boolean(journey.emailVerifiedAt),
    emailResendAvailableAt: journey.verificationEmailSentAt
      ? new Date(journey.verificationEmailSentAt.getTime() + SIGNUP_EMAIL_RESEND_COOLDOWN_SECONDS * 1000).toISOString()
      : null,
    paymentConfirmed: Boolean(journey.paymentConfirmedAt),
    activated: Boolean(journey.activatedAt),
    choicesEditable: !signupChoicesLocked(journey),
    salesCodeApplied: Boolean(journey.salesCodeId),
  };
}

export async function getActiveSignupCatalog(at = new Date()): Promise<SignupCatalog> {
  const catalog = await prisma.saasCatalogVersion.findFirst({
    where: { status: "ACTIVE", effectiveAt: { lte: at } },
    orderBy: { effectiveAt: "desc" },
    include: { plans: { orderBy: { monthlyPriceCents: "asc" } }, options: { orderBy: { monthlyPriceCents: "asc" } } },
  });
  if (!catalog) throw new Error("SIGNUP_CATALOG_UNAVAILABLE");
  return {
    id: catalog.id,
    code: catalog.code,
    currency: catalog.currency,
    vatRateBps: catalog.vatRateBps,
    plans: catalog.plans,
    options: catalog.options.map((option) => ({
      id: option.id,
      code: option.code,
      name: option.name,
      kind: option.kind,
      featureKey: option.featureKey,
      monthlyPriceCents: option.monthlyPriceCents,
      annualPriceCents: option.annualPriceCents,
      applicablePlans: option.applicablePlans,
    })),
  };
}

export function buildSignupQuote(
  catalog: SignupCatalog,
  planCode: SaasPlanCode,
  billingInterval: SaasBillingInterval,
  rawSelections: SignupOptionSelection[]
): SignupQuote {
  const plan = catalog.plans.find((candidate) => candidate.code === planCode);
  if (!plan) throw new Error("SIGNUP_PLAN_INVALID");
  const seen = new Set<string>();
  const selections = rawSelections.map((selection) => ({ code: selection.code.trim(), quantity: selection.quantity }));
  let optionsPriceCents = 0;
  let driverExtras = 0;
  let adminExtras = 0;
  let dispatcherExtras = 0;
  for (const selection of selections) {
    if (!selection.code || seen.has(selection.code)) throw new Error("SIGNUP_OPTION_INVALID");
    seen.add(selection.code);
    if (!Number.isInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 500) {
      throw new Error("SIGNUP_OPTION_QUANTITY_INVALID");
    }
    const option = catalog.options.find((candidate) => candidate.code === selection.code);
    if (!option || !option.applicablePlans.includes(planCode)) throw new Error("SIGNUP_OPTION_INVALID");
    if (option.featureKey && plan.includedFeatures.includes(option.featureKey)) throw new Error("SIGNUP_OPTION_ALREADY_INCLUDED");
    if (option.kind === "OPTION" && selection.quantity !== 1) throw new Error("SIGNUP_OPTION_QUANTITY_INVALID");
    if (option.kind === "DRIVER_SEAT") driverExtras += selection.quantity;
    if (option.kind === "ADMIN_SEAT") adminExtras += selection.quantity;
    if (option.kind === "DISPATCHER_SEAT") dispatcherExtras += selection.quantity;
    optionsPriceCents += (billingInterval === "ANNUAL" ? option.annualPriceCents : option.monthlyPriceCents) * selection.quantity;
  }
  if (!plan.unlimitedDriverSeats && plan.maxDriverSeats != null && plan.includedDriverSeats + driverExtras > plan.maxDriverSeats) {
    throw new Error("SIGNUP_DRIVER_LIMIT_EXCEEDED");
  }
  if (plan.maxAdminSeats != null && plan.includedAdminSeats + adminExtras > plan.maxAdminSeats) {
    throw new Error("SIGNUP_ADMIN_LIMIT_EXCEEDED");
  }
  if (plan.maxDispatcherSeats != null && plan.includedDispatcherSeats + dispatcherExtras > plan.maxDispatcherSeats) {
    throw new Error("SIGNUP_DISPATCHER_LIMIT_EXCEEDED");
  }
  const planPriceCents = billingInterval === "ANNUAL" ? plan.annualPriceCents : plan.monthlyPriceCents;
  const totalHtCents = planPriceCents + optionsPriceCents;
  const vatCents = Math.round((totalHtCents * catalog.vatRateBps) / 10_000);
  return {
    schemaVersion: 1,
    catalogCode: catalog.code,
    planCode,
    planName: plan.name,
    billingInterval,
    currency: catalog.currency,
    vatRateBps: catalog.vatRateBps,
    planPriceCents,
    optionsPriceCents,
    totalHtCents,
    vatCents,
    totalTtcCents: totalHtCents + vatCents,
    includedMonthlyOrders: plan.includedMonthlyOrders,
    orderOverageUnitPriceCents: plan.orderOverageUnitPriceCents,
    selections,
  };
}

/** SALES-1 : absent = inchangé, vide ou `null` = retiré, sinon un code actif obligatoire. */
async function salesCodeChange(salesCode: string | null | undefined) {
  if (salesCode === undefined) return {};
  if (salesCode === null || salesCode.trim() === "") return { salesCodeId: null };
  return { salesCodeId: await resolveActiveSalesCodeId(salesCode) };
}

export async function createSignupJourney(input: {
  planCode: SaasPlanCode;
  billingInterval: SaasBillingInterval;
  optionSelections: SignupOptionSelection[];
  salesCode?: string | null;
}) {
  const catalog = await getActiveSignupCatalog();
  const quote = buildSignupQuote(catalog, input.planCode, input.billingInterval, input.optionSelections);
  const salesCode = await salesCodeChange(input.salesCode);
  const resumeToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SIGNUP_TTL_SECONDS * 1000);
  const journey = await prisma.signupJourney.create({
    data: {
      resumeTokenHash: hashToken(resumeToken),
      catalogVersionId: catalog.id,
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      optionSelections: quote.selections,
      quoteSnapshot: quote as unknown as Prisma.InputJsonValue,
      expiresAt,
      ...salesCode,
    },
  });
  return { resumeToken, journey: publicJourney(journey) };
}

async function requireJourney(resumeToken: string) {
  const journey = await prisma.signupJourney.findUnique({ where: { resumeTokenHash: hashToken(resumeToken) } });
  if (!journey || journey.expiresAt <= new Date() || !tokenMatches(resumeToken, journey.resumeTokenHash)) {
    throw new Error("SIGNUP_RESUME_INVALID");
  }
  return journey;
}

function signupChoicesLocked(journey: NonNullable<JourneyRecord>) {
  return Boolean(
    journey.failureCode === "STRIPE_CHECKOUT_LOCKED" ||
    journey.paymentConfirmedAt ||
    journey.activatedAt ||
    journey.companyId ||
    journey.status === "ACTIVATED" ||
    journey.status === "FAILED"
  );
}

async function reconcileSignupEmailConfirmation(journey: NonNullable<JourneyRecord>) {
  if (journey.status !== "EMAIL_PENDING" || journey.emailVerifiedAt || !journey.authUserId || !journey.email) {
    return journey;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(journey.authUserId);
  if (error || !data?.user?.email_confirmed_at || !data.user.email || normalizeEmail(data.user.email) !== journey.email) {
    return journey;
  }
  await prisma.signupJourney.updateMany({
    where: {
      id: journey.id,
      status: "EMAIL_PENDING",
      emailVerifiedAt: null,
      authUserId: journey.authUserId,
    },
    data: {
      emailLinkTokenHash: null,
      status: journey.paymentConfirmedAt ? "PAYMENT_CONFIRMED" : "EMAIL_VERIFIED",
      emailVerifiedAt: new Date(),
    },
  });
  return prisma.signupJourney.findUniqueOrThrow({ where: { id: journey.id } });
}

export async function getSignupJourney(resumeToken: string) {
  return publicJourney(await reconcileSignupEmailConfirmation(await requireJourney(resumeToken)));
}

export async function updateSignupSelection(resumeToken: string, input: {
  planCode: SaasPlanCode;
  billingInterval: SaasBillingInterval;
  optionSelections: SignupOptionSelection[];
  salesCode?: string | null;
}) {
  const journey = await requireJourney(resumeToken);
  if (signupChoicesLocked(journey)) throw new Error("SIGNUP_SELECTION_LOCKED");
  const salesCode = await salesCodeChange(input.salesCode);
  const catalog = await prisma.saasCatalogVersion.findUnique({
    where: { id: journey.catalogVersionId },
    include: { plans: true, options: true },
  });
  if (!catalog) throw new Error("SIGNUP_CATALOG_UNAVAILABLE");
  const quote = buildSignupQuote(catalog as SignupCatalog, input.planCode, input.billingInterval, input.optionSelections);
  const updated = await prisma.signupJourney.update({
    where: { id: journey.id },
    data: {
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      optionSelections: quote.selections,
      quoteSnapshot: quote as unknown as Prisma.InputJsonValue,
      ...salesCode,
    },
  });
  return publicJourney(updated);
}

export type SignupIdentityInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  phone?: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;
};

export async function submitSignupIdentity(resumeToken: string, input: SignupIdentityInput) {
  const journey = await requireJourney(resumeToken);
  if (!(["DRAFT", "EMAIL_PENDING"] as const).includes(journey.status as "DRAFT" | "EMAIL_PENDING")) {
    throw new Error("SIGNUP_IDENTITY_LOCKED");
  }
  const email = normalizeEmail(input.email);
  if (journey.status === "EMAIL_PENDING" && journey.email && journey.email !== email) {
    throw new Error("SIGNUP_IDENTITY_LOCKED");
  }
  const emailLinkToken = randomBytes(32).toString("base64url");
  const previousSentAt = journey.verificationEmailSentAt;
  const verificationEmailSentAt = new Date();
  const persisted = await prisma.signupJourney.update({
    where: { id: journey.id },
    data: {
      status: "EMAIL_PENDING",
      email,
      emailLinkTokenHash: hashToken(emailLinkToken),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      companyName: input.companyName.trim(),
      legalName: input.legalName?.trim() || null,
      siren: input.siren?.replace(/\s/g, "") || null,
      siret: input.siret?.replace(/\s/g, "") || null,
      phone: input.phone?.trim() || null,
      billingAddress: input.billingAddress.trim(),
      billingPostalCode: input.billingPostalCode.trim(),
      billingCity: input.billingCity.trim(),
      billingCountry: input.billingCountry,
      failureCode: null,
      verificationEmailSentAt,
    },
  });

  try {
    await deliverSignupConfirmationEmail({
      email,
      password: input.password,
      journeyId: persisted.id,
      emailLinkToken,
      knownAuthUserId: persisted.authUserId,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_EMAIL_FAILED";
    await prisma.signupJourney.updateMany({
      where: { id: persisted.id, status: "EMAIL_PENDING" },
      data: { verificationEmailSentAt: previousSentAt, failureCode: code.startsWith("AUTH_") ? code : "AUTH_EMAIL_FAILED" },
    });
    throw error;
  }
  const latest = await prisma.signupJourney.findUniqueOrThrow({ where: { id: persisted.id } });
  const verified = await reconcileSignupEmailConfirmation(latest);
  if (verified.emailVerifiedAt) {
    return { verificationRequired: false as const, journey: publicJourney(verified) };
  }
  return { verificationRequired: true as const };
}

export async function updateSignupIdentityDetails(resumeToken: string, input: Omit<SignupIdentityInput, "password">) {
  const journey = await requireJourney(resumeToken);
  if (
    signupChoicesLocked(journey) ||
    !journey.emailVerifiedAt ||
    !["EMAIL_VERIFIED", "PAYMENT_PENDING"].includes(journey.status)
  ) {
    throw new Error("SIGNUP_IDENTITY_LOCKED");
  }
  const email = normalizeEmail(input.email);
  if (!journey.email || email !== journey.email) throw new Error("SIGNUP_IDENTITY_LOCKED");
  const updated = await prisma.signupJourney.update({
    where: { id: journey.id },
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      companyName: input.companyName.trim(),
      legalName: input.legalName?.trim() || null,
      siren: input.siren?.replace(/\s/g, "") || null,
      siret: input.siret?.replace(/\s/g, "") || null,
      phone: input.phone?.trim() || null,
      billingAddress: input.billingAddress.trim(),
      billingPostalCode: input.billingPostalCode.trim(),
      billingCity: input.billingCity.trim(),
      billingCountry: input.billingCountry,
      failureCode: null,
    },
  });
  return publicJourney(updated);
}

export async function resendSignupConfirmation(resumeToken: string) {
  const journey = await requireJourney(resumeToken);
  if (journey.status !== "EMAIL_PENDING" || !journey.email || journey.emailVerifiedAt) {
    throw new Error("SIGNUP_RESEND_INVALID");
  }
  const now = new Date();
  const availableBefore = new Date(now.getTime() - SIGNUP_EMAIL_RESEND_COOLDOWN_SECONDS * 1000);
  const previousSentAt = journey.verificationEmailSentAt;
  const reserved = await prisma.signupJourney.updateMany({
    where: {
      id: journey.id,
      status: "EMAIL_PENDING",
      emailVerifiedAt: null,
      OR: [
        { verificationEmailSentAt: null },
        { verificationEmailSentAt: { lte: availableBefore } },
      ],
    },
    data: { verificationEmailSentAt: now, failureCode: null },
  });
  if (reserved.count !== 1) throw new Error("SIGNUP_EMAIL_RESEND_COOLDOWN");

  const emailLinkToken = randomBytes(32).toString("base64url");
  await prisma.signupJourney.update({
    where: { id: journey.id },
    data: { emailLinkTokenHash: hashToken(emailLinkToken) },
  });
  try {
    const result = await deliverOrReuseSignupConfirmation({
      email: journey.email,
      journeyId: journey.id,
      emailLinkToken,
      knownAuthUserId: journey.authUserId,
    });
    if (result === "already_verified") {
      const verified = await reconcileSignupEmailConfirmation(
        await prisma.signupJourney.findUniqueOrThrow({ where: { id: journey.id } })
      );
      return { verificationRequired: false as const, journey: publicJourney(verified) };
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_EMAIL_FAILED";
    if (code === "AUTH_RATE_LIMITED") {
      await prisma.signupJourney.updateMany({
        where: { id: journey.id, status: "EMAIL_PENDING", verificationEmailSentAt: now },
        data: { failureCode: "AUTH_RATE_LIMITED" },
      });
      throw error;
    }
    await prisma.signupJourney.updateMany({
      where: { id: journey.id, status: "EMAIL_PENDING", verificationEmailSentAt: now },
      data: { verificationEmailSentAt: previousSentAt, failureCode: "AUTH_EMAIL_FAILED" },
    });
    throw error instanceof Error ? error : new Error("AUTH_EMAIL_FAILED");
  }
  const updated = await prisma.signupJourney.findUniqueOrThrow({ where: { id: journey.id } });
  return { verificationRequired: true as const, journey: publicJourney(updated) };
}

function isMissingAuthUser(error: { status?: number; code?: string } | null) {
  return error?.status === 404 || error?.code === "user_not_found";
}

function signupAuthMetadata(journeyId: string, emailLinkToken: string) {
  return { signup_flow: "managed", signup_draft_id: journeyId, signup_link_token: emailLinkToken };
}

function authEmailRedirectTo() {
  const redirect = getPasswordLinkRedirect();
  const hostname = new URL(redirect).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" ? undefined : redirect;
}

async function confirmAuthUserEmailViaAdmin(authUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(authUserId, { email_confirm: true });
  if (error || !data.user) throw new Error("AUTH_EMAIL_FAILED");
  return data.user;
}

async function provisionAuthUserWithoutEmail(input: {
  email: string;
  password: string;
  journeyId: string;
  emailLinkToken: string;
  knownAuthUserId?: string;
}) {
  const admin = createAdminClient();
  const metadata = signupAuthMetadata(input.journeyId, input.emailLinkToken);
  if (input.knownAuthUserId) {
    const updated = await admin.auth.admin.updateUserById(input.knownAuthUserId, {
      password: input.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (!updated.error && updated.data.user) return updated.data.user;
  }
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (!created.error && created.data.user) return created.data.user;
  const existing = await findAuthUserByEmail(input.email);
  if (!existing) throw new Error("AUTH_EMAIL_FAILED");
  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (updated.error || !updated.data.user) throw new Error("AUTH_EMAIL_FAILED");
  return updated.data.user;
}

async function annonaUserExists(input: { authUserId?: string | null; email: string }) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(input.authUserId ? [{ authId: input.authUserId }] : []),
        { email: { equals: input.email, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const normalized = normalizeEmail(email);
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("AUTH_EMAIL_FAILED");
    const found = data.users.find((user) => user.email && normalizeEmail(user.email) === normalized);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function attachSignupAuthUser(journeyId: string, email: string, authUserId: string) {
  await prisma.signupJourney.updateMany({
    where: { id: journeyId, email, status: "EMAIL_PENDING" },
    data: { authUserId },
  });
}

async function resendUnconfirmedSignupEmail(email: string, redirectTo: string | undefined) {
  const client = createPasswordLinkClient();
  const { error } = await client.auth.resend({
    type: "signup",
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : {},
  });
  if (error?.status === 429) {
    if (!signupTestShortcutsAllowed()) throw new Error("AUTH_RATE_LIMITED");
    const found = await findAuthUserByEmail(email);
    if (!found) throw new Error("AUTH_RATE_LIMITED");
    await confirmAuthUserEmailViaAdmin(found.id);
    return;
  }
  if (error) throw new Error("AUTH_EMAIL_FAILED");
}

async function createManagedAuthUser(input: {
  email: string;
  password: string;
  journeyId: string;
  emailLinkToken: string;
  redirectTo: string | undefined;
}) {
  const client = createPasswordLinkClient();
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      ...(input.redirectTo ? { emailRedirectTo: input.redirectTo } : {}),
      data: signupAuthMetadata(input.journeyId, input.emailLinkToken),
    },
  });
  if (error?.status === 429) {
    if (!signupTestShortcutsAllowed()) throw new Error("AUTH_RATE_LIMITED");
    return provisionAuthUserWithoutEmail(input);
  }
  if (error) throw new Error("AUTH_EMAIL_FAILED");
  if (data.session) {
    await client.auth.signOut({ scope: "global" });
    throw new Error("AUTH_EMAIL_CONFIRMATION_REQUIRED");
  }
  if (data.user?.id && (data.user.identities?.length ?? 1) > 0) return data.user;
  return null;
}

async function reuseUnconfirmedAuthUser(input: {
  authUserId: string;
  password?: string;
  email: string;
  journeyId: string;
  emailLinkToken: string;
  redirectTo: string | undefined;
}) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.authUserId, {
    ...(input.password ? { password: input.password } : {}),
    user_metadata: signupAuthMetadata(input.journeyId, input.emailLinkToken),
  });
  if (error) throw new Error("AUTH_EMAIL_FAILED");
  await attachSignupAuthUser(input.journeyId, input.email, input.authUserId);
  await resendUnconfirmedSignupEmail(input.email, input.redirectTo);
}

async function deleteOrphanAuthUser(authUserId: string) {
  const existingUser = await prisma.user.findUnique({ where: { authId: authUserId }, select: { id: true } });
  if (existingUser) return false;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(authUserId);
  if (error && !isMissingAuthUser(error)) throw new Error("AUTH_EMAIL_FAILED");
  return true;
}

async function resolveSignupAuthUser(knownAuthUserId: string | null, email: string) {
  const admin = createAdminClient();
  if (knownAuthUserId) {
    const { data, error } = await admin.auth.admin.getUserById(knownAuthUserId);
    if (error && !isMissingAuthUser(error)) throw new Error("AUTH_EMAIL_FAILED");
    if (data?.user) return data.user;
  }
  return findAuthUserByEmail(email);
}

async function deliverOrReuseSignupConfirmation(input: {
  email: string;
  journeyId: string;
  emailLinkToken: string;
  knownAuthUserId: string | null;
  password?: string;
}) {
  const redirectTo = authEmailRedirectTo();
  const found = await resolveSignupAuthUser(input.knownAuthUserId, input.email);

  if (found && !found.email_confirmed_at) {
    // Un compte invité non confirmé appartient à son invité : l'inscription n'y touche jamais (AUDIT-0111, S1).
    if (await annonaUserExists({ authUserId: found.id, email: input.email })) return "already_registered" as const;
    await reuseUnconfirmedAuthUser({
      authUserId: found.id,
      password: input.password,
      email: input.email,
      journeyId: input.journeyId,
      emailLinkToken: input.emailLinkToken,
      redirectTo,
    });
    return "sent" as const;
  }
  if (found?.email_confirmed_at) {
    if (await annonaUserExists({ authUserId: found.id, email: input.email })) return "already_registered" as const;
    if (!input.password) {
      await attachSignupAuthUser(input.journeyId, input.email, found.id);
      return "already_verified" as const;
    }
    const deleted = await deleteOrphanAuthUser(found.id);
    if (!deleted) return "already_registered" as const;
  }

  if (!input.password) {
    await resendUnconfirmedSignupEmail(input.email, redirectTo);
    return "sent" as const;
  }

  const created = await createManagedAuthUser({
    email: input.email,
    password: input.password,
    journeyId: input.journeyId,
    emailLinkToken: input.emailLinkToken,
    redirectTo,
  });
  if (created) {
    await attachSignupAuthUser(input.journeyId, input.email, created.id);
    return "sent" as const;
  }

  const leftover = await findAuthUserByEmail(input.email);
  if (leftover && !leftover.email_confirmed_at) {
    if (await annonaUserExists({ authUserId: leftover.id, email: input.email })) return "already_registered" as const;
    await reuseUnconfirmedAuthUser({
      authUserId: leftover.id,
      password: input.password,
      email: input.email,
      journeyId: input.journeyId,
      emailLinkToken: input.emailLinkToken,
      redirectTo,
    });
    return "sent" as const;
  }
  if (leftover?.email_confirmed_at) {
    if (await annonaUserExists({ authUserId: leftover.id, email: input.email })) return "already_registered" as const;
    const deleted = await deleteOrphanAuthUser(leftover.id);
    if (!deleted) return "already_registered" as const;
    const retry = await createManagedAuthUser({
      email: input.email,
      password: input.password,
      journeyId: input.journeyId,
      emailLinkToken: input.emailLinkToken,
      redirectTo,
    });
    if (retry) await attachSignupAuthUser(input.journeyId, input.email, retry.id);
    return "sent" as const;
  }

  await resendUnconfirmedSignupEmail(input.email, redirectTo);
  return "sent" as const;
}

async function deliverSignupConfirmationEmail(input: {
  email: string;
  password: string;
  journeyId: string;
  emailLinkToken: string;
  knownAuthUserId: string | null;
}) {
  await deliverOrReuseSignupConfirmation(input);
}

export async function reopenSignupIdentity(resumeToken: string) {
  const journey = await requireJourney(resumeToken);
  if (journey.status !== "EMAIL_PENDING" || journey.emailVerifiedAt || journey.paymentConfirmedAt || journey.companyId) {
    throw new Error("SIGNUP_EDIT_IDENTITY_LOCKED");
  }
  const admin = createAdminClient();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "signup_journeys" WHERE id = ${journey.id} FOR UPDATE`;
    const locked = await tx.signupJourney.findUnique({ where: { id: journey.id } });
    if (!locked || locked.status !== "EMAIL_PENDING" || locked.emailVerifiedAt || locked.paymentConfirmedAt || locked.companyId) {
      throw new Error("SIGNUP_EDIT_IDENTITY_LOCKED");
    }
    if (locked.authUserId) {
      const { data, error } = await admin.auth.admin.getUserById(locked.authUserId);
      if (error && !isMissingAuthUser(error)) throw new Error("SIGNUP_EDIT_IDENTITY_FAILED");
      if (data?.user) {
        if (!data.user.email || normalizeEmail(data.user.email) !== locked.email) {
          throw new Error("SIGNUP_EDIT_IDENTITY_LOCKED");
        }
        const existingUser = await tx.user.findUnique({
          where: { authId: locked.authUserId },
          select: { id: true },
        });
        if (existingUser) throw new Error("SIGNUP_EDIT_IDENTITY_LOCKED");
        const { error: deleteError } = await admin.auth.admin.deleteUser(locked.authUserId);
        if (deleteError && !isMissingAuthUser(deleteError)) throw new Error("SIGNUP_EDIT_IDENTITY_FAILED");
      }
    }
    return tx.signupJourney.update({
      where: { id: locked.id },
      data: {
        status: "DRAFT",
        authUserId: null,
        emailLinkTokenHash: null,
        emailVerifiedAt: null,
        verificationEmailSentAt: null,
        failureCode: null,
      },
    });
  }, { maxWait: 10_000, timeout: 30_000 });
  return publicJourney(updated);
}

export async function confirmManagedSignupEmail(input: {
  draftId: string;
  linkToken: string;
  authUserId: string;
  email: string;
}) {
  const email = normalizeEmail(input.email);
  const resumeToken = randomBytes(32).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "signup_journeys" WHERE id = ${input.draftId} FOR UPDATE`;
    const journey = await tx.signupJourney.findUnique({ where: { id: input.draftId } });
    if (!journey || journey.status !== "EMAIL_PENDING" || journey.expiresAt <= new Date() || !journey.emailLinkTokenHash ||
        !tokenMatches(input.linkToken, journey.emailLinkTokenHash) ||
        (journey.authUserId !== null && journey.authUserId !== input.authUserId) || journey.email !== email) {
      throw new Error("AUTH_LINK_INVALID");
    }
    await tx.signupJourney.update({
      where: { id: journey.id },
      data: {
        authUserId: input.authUserId,
        resumeTokenHash: hashToken(resumeToken),
        emailLinkTokenHash: null,
        status: journey.paymentConfirmedAt ? "PAYMENT_CONFIRMED" : "EMAIL_VERIFIED",
        emailVerifiedAt: journey.emailVerifiedAt ?? new Date(),
      },
    });
  });
  return { resumeToken };
}

export function signupPeriodEnd(startsAt: Date, interval: SaasBillingInterval) {
  const result = new Date(startsAt);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  if (interval === "ANNUAL") result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0
  )).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export async function activateSignupJourney(signupId: string) {
  try {
    const activation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "signup_journeys" WHERE id = ${signupId} FOR UPDATE`;
      const journey = await tx.signupJourney.findUnique({
        where: { id: signupId },
        include: { catalogVersion: { include: { plans: true, options: true } } },
      });
      if (!journey) throw new Error("SIGNUP_RESUME_INVALID");
      if (journey.status === "ACTIVATED" && journey.companyId) {
        const welcomeJob = await tx.operationJob.findUnique({
          where: { jobKey: `signup-welcome:${journey.id}` },
          select: { id: true },
        });
        return {
          companyId: journey.companyId,
          email: journey.email!,
          authUserId: journey.authUserId,
          alreadyActivated: true,
          welcomeJobId: welcomeJob?.id ?? null,
        };
      }
      if (!journey.emailVerifiedAt || !journey.paymentConfirmedAt || !journey.authUserId || !journey.email ||
          !journey.firstName || !journey.lastName || !journey.companyName || !journey.billingAddress ||
          !journey.billingPostalCode || !journey.billingCity) {
        throw new Error("SIGNUP_NOT_READY");
      }
      const catalog = journey.catalogVersion as unknown as SignupCatalog;
      const quote = buildSignupQuote(catalog, journey.planCode, journey.billingInterval, asSelections(journey.optionSelections));
      const storedQuote = quoteFromJson(journey.quoteSnapshot);
      if (!signupQuoteMatches(quote, storedQuote)) throw new Error("SIGNUP_QUOTE_STALE");
      const confirmed = await tx.signupPaymentEvent.findFirst({
        where: { signupId: journey.id, status: "CONFIRMED", amountCents: quote.totalTtcCents, currency: quote.currency },
      });
      if (!confirmed) throw new Error("SIGNUP_PAYMENT_UNCONFIRMED");
      const duplicateUser = await tx.user.findFirst({
        where: { OR: [{ authId: journey.authUserId }, { email: { equals: journey.email, mode: "insensitive" } }] },
        select: { id: true },
      });
      const duplicateCompany = await tx.company.findFirst({
        where: { OR: [
          ...(journey.siren ? [{ siren: journey.siren }] : []),
          ...(journey.siret ? [{ siret: journey.siret }] : []),
        ] },
        select: { id: true },
      });
      if (duplicateUser || duplicateCompany) throw new Error("SIGNUP_ALREADY_EXISTS");
      const role = await tx.role.findUnique({ where: { slug: "company-admin" } });
      const plan = journey.catalogVersion.plans.find((candidate) => candidate.code === journey.planCode);
      if (!role || !plan) throw new Error("SIGNUP_PROVISIONING_UNAVAILABLE");
      const now = new Date();
      const premiumDiscoveryEndsAt = premiumDiscoveryEndsAtForPaidSignup({
        startsAt: now,
        planCode: journey.planCode,
        paymentAdapter: paymentAdapterFromSnapshot(confirmed.snapshot),
      });
      const company = await tx.company.create({
        data: {
          name: journey.companyName,
          legalName: journey.legalName,
          slug: `${slugify(journey.companyName)}-${journey.id.slice(-8)}`,
          email: journey.email,
          phone: journey.phone,
          address: journey.billingAddress,
          city: journey.billingCity,
          country: journey.billingCountry,
          billingAddress: journey.billingAddress,
          billingPostalCode: journey.billingPostalCode,
          billingCity: journey.billingCity,
          siren: journey.siren,
          siret: journey.siret,
          status: "ACTIVE",
          settings: { legalBilling: { postalCode: journey.billingPostalCode, country: journey.billingCountry } },
        },
      });
      const subscription = await tx.saasSubscription.create({
        data: {
          companyId: company.id,
          catalogVersionId: journey.catalogVersionId,
          kind: "COMMERCIAL",
          status: "ACTIVE",
          billingInterval: journey.billingInterval,
          startsAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: signupPeriodEnd(now, journey.billingInterval),
          premiumDiscoveryEndsAt,
          snapshot: { schemaVersion: 1, signupId: journey.id, catalogCode: journey.catalogVersion.code, quote },
        },
      });
      await tx.saasPlanAssignment.create({
        data: { subscriptionId: subscription.id, planId: plan.id, effectiveFrom: now, snapshot: snapshotPlan(plan) },
      });
      const selections = asSelections(journey.optionSelections);
      for (const selection of selections) {
        const option = journey.catalogVersion.options.find((candidate) => candidate.code === selection.code);
        if (!option) throw new Error("SIGNUP_OPTION_INVALID");
        const unitPriceCents = journey.billingInterval === "ANNUAL" ? option.annualPriceCents : option.monthlyPriceCents;
        await tx.saasSubscriptionItem.create({
          data: {
            subscriptionId: subscription.id,
            optionId: option.id,
            code: option.code,
            kind: option.kind,
            source: "INITIAL",
            quantity: selection.quantity,
            unitPriceCents,
            effectiveFrom: now,
            snapshot: { schemaVersion: 1, optionCode: option.code, optionName: option.name, featureKey: option.featureKey, billingInterval: journey.billingInterval, unitPriceCents },
          },
        });
      }
      const user = await tx.user.create({
        data: {
          authId: journey.authUserId,
          email: journey.email,
          firstName: journey.firstName,
          lastName: journey.lastName,
          status: "ACTIVE",
          roleId: role.id,
          companyId: company.id,
          settings: { onboardingRequired: true },
        },
      });
      await attributeSignupSale(tx, {
        signupId: journey.id,
        salesCodeId: journey.salesCodeId,
        companyId: company.id,
        quote,
        options: catalog.options,
        now,
      });
      await tx.signupJourney.update({
        where: { id: journey.id },
        data: { status: "ACTIVATED", activatedAt: now, companyId: company.id, failureCode: null },
      });
      const welcomeJob = await enqueueOperationJob(tx, {
        jobKey: `signup-welcome:${journey.id}`,
        type: "CLIENT_NOTIFICATION",
        companyId: company.id,
        payload: {
          kind: "SIGNUP_WELCOME",
          signupId: journey.id,
          companyId: company.id,
          userId: user.id,
        },
      });
      return {
        companyId: company.id,
        email: journey.email,
        authUserId: journey.authUserId,
        alreadyActivated: false,
        welcomeJobId: welcomeJob.id,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (activation.welcomeJobId) kickOperationJob(activation.welcomeJobId);
    return {
      companyId: activation.companyId,
      email: activation.email,
      authUserId: activation.authUserId,
      alreadyActivated: activation.alreadyActivated,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("SIGNUP_ALREADY_EXISTS");
    }
    throw error;
  }
}

function signupWelcomePayload(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SIGNUP_WELCOME_PAYLOAD_INVALID");
  }
  const signupId = typeof value.signupId === "string" ? value.signupId : null;
  const companyId = typeof value.companyId === "string" ? value.companyId : null;
  const userId = typeof value.userId === "string" ? value.userId : null;
  if (value.kind !== "SIGNUP_WELCOME" || !signupId || !companyId || !userId) {
    throw new Error("SIGNUP_WELCOME_PAYLOAD_INVALID");
  }
  return { signupId, companyId, userId };
}

export async function deliverSignupWelcomeEmail(
  rawPayload: Prisma.JsonValue,
  eventKey: string,
  // Fenêtre de la tâche : 23 h après la première tentative émise, plus de renvoi automatique.
  replayWindow: ReplayWindowStart = null,
  // Rendu figé à la première tentative émise (nom, offre ou adresse modifiés entre deux essais).
  freezeContent?: EmailContentFreezer
) {
  const payload = signupWelcomePayload(rawPayload);
  const journey = await prisma.signupJourney.findFirst({
    where: {
      id: payload.signupId,
      companyId: payload.companyId,
      status: "ACTIVATED",
    },
    select: {
      companyName: true,
      planCode: true,
      billingInterval: true,
      company: {
        select: {
          users: {
            where: { id: payload.userId, status: "ACTIVE" },
            select: { email: true, firstName: true },
            take: 1,
          },
        },
      },
    },
  });
  const user = journey?.company?.users[0];
  if (!journey || !user) throw new Error("SIGNUP_WELCOME_TARGET_INVALID");

  const interval = journey.billingInterval === "ANNUAL" ? "annuel" : "mensuel";
  const delivery = await sendTransactionalEmail({
    to: user.email,
    subject: "Bienvenue sur Annona",
    fromAnnona: true,
    text: [
      `Bonjour ${user.firstName},`,
      "",
      `Votre espace ${journey.companyName ?? "Annona"} est prêt avec l’offre ${journey.planCode} (${interval}).`,
      "Connectez-vous puis suivez l’assistant pour ajouter vos livreurs, vos clients et créer votre première livraison.",
      "",
      ...(process.env.NEXT_PUBLIC_APP_URL ? [`Découvrir mon espace : ${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/onboarding`, ""] : []),
      "L’équipe Annona",
    ].join("\n"),
    idempotencyKey: eventKey,
    replayWindowStart: replayWindow,
    freezeContent,
  });
  if (delivery.status === "disabled") {
    // E-mail explicitement désactivé (EMAIL_DELIVERY_MODE=disabled, ex. développement) : tâche sans
    // objet, pas un échec du cron. Variable absente (oubli possible en production) ou configuration
    // incomplète : vrai échec, signalé et rejoué (RECETTE-2810, point 10).
    if (delivery.reason === "disabled") throw skippedJobError("SIGNUP_WELCOME_EMAIL_DISABLED");
    throw new Error("SIGNUP_WELCOME_EMAIL_NOT_CONFIGURED");
  }
  return delivery;
}

export async function processFakeSignupPayment(resumeToken: string, input: {
  eventKey: string;
  outcome: "confirmed" | "declined" | "pending";
}) {
  if (process.env.SIGNUP_PAYMENT_ADAPTER === "stripe-sandbox") throw new Error("SIGNUP_FAKE_PAYMENT_DISABLED");
  const journey = await requireJourney(resumeToken);
  if (!journey.emailVerifiedAt) throw new Error("SIGNUP_EMAIL_UNVERIFIED");
  const quote = quoteFromJson(journey.quoteSnapshot);
  const status: SignupPaymentStatus = input.outcome === "confirmed" ? "CONFIRMED" : input.outcome === "declined" ? "DECLINED" : "PENDING";
  const event = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "signup_journeys" WHERE id = ${journey.id} FOR UPDATE`;
    const existing = await tx.signupPaymentEvent.findUnique({ where: { eventKey: input.eventKey } });
    if (existing) {
      if (existing.signupId !== journey.id || existing.amountCents !== quote.totalTtcCents || existing.currency !== quote.currency) {
        throw new Error("SIGNUP_PAYMENT_EVENT_INVALID");
      }
      return existing;
    }
    const created = await tx.signupPaymentEvent.create({
      data: {
        eventKey: input.eventKey,
        signupId: journey.id,
        status,
        amountCents: quote.totalTtcCents,
        currency: quote.currency,
        snapshot: { schemaVersion: 1, adapter: "fake", outcome: input.outcome },
      },
    });
    const next = nextSignupPaymentState(Boolean(journey.paymentConfirmedAt), status);
    if (next.confirmsPayment) {
      await tx.signupJourney.update({
        where: { id: journey.id },
        data: { status: next.status, paymentConfirmedAt: new Date(), failureCode: next.failureCode },
      });
    } else if (!journey.paymentConfirmedAt) {
      await tx.signupJourney.update({
        where: { id: journey.id },
        data: { status: next.status, failureCode: next.failureCode },
      });
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (event.status !== "CONFIRMED") return { status: event.status, activated: false as const };
  const activation = await activateSignupJourney(journey.id);
  return { status: event.status, activated: true as const, ...activation };
}

export function signupPaidEnvironmentPath(email: string, sessionOpened: boolean) {
  if (sessionOpened) return "/onboarding";
  return `/login?email=${encodeURIComponent(email)}&redirect=/onboarding`;
}
