import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, type SaasBillingInterval, type SaasPlanCode, type SignupPaymentStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { createPasswordLinkClient } from "@/services/supabase/password-link";
import { getPasswordLinkRedirect } from "@/lib/auth/email-links";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { slugify } from "@/lib/utils";
import { snapshotPlan } from "@/domains/saas/saas.service";
import {
  enqueueOperationJob,
  kickOperationJob,
} from "@/domains/operations/operation-job.service";
import { sendTransactionalEmail } from "@/lib/email/transactional-email";

export const SIGNUP_COOKIE = "tutelliv-signup-resume";
export const SIGNUP_TTL_SECONDS = 30 * 24 * 60 * 60;

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
    paymentConfirmed: Boolean(journey.paymentConfirmedAt),
    activated: Boolean(journey.activatedAt),
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

export async function createSignupJourney(input: {
  planCode: SaasPlanCode;
  billingInterval: SaasBillingInterval;
  optionSelections: SignupOptionSelection[];
}) {
  const catalog = await getActiveSignupCatalog();
  const quote = buildSignupQuote(catalog, input.planCode, input.billingInterval, input.optionSelections);
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

export async function getSignupJourney(resumeToken: string) {
  return publicJourney(await requireJourney(resumeToken));
}

export async function updateSignupSelection(resumeToken: string, input: {
  planCode: SaasPlanCode;
  billingInterval: SaasBillingInterval;
  optionSelections: SignupOptionSelection[];
}) {
  const journey = await requireJourney(resumeToken);
  if (journey.status !== "DRAFT") throw new Error("SIGNUP_SELECTION_LOCKED");
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
  if (journey.status === "EMAIL_PENDING" && journey.authUserId) {
    return { verificationRequired: true as const };
  }
  const emailLinkToken = randomBytes(32).toString("base64url");
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
    },
  });

  const redirectTo = getPasswordLinkRedirect();
  const client = createPasswordLinkClient();
  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        signup_flow: "managed",
        signup_draft_id: journey.id,
        signup_link_token: emailLinkToken,
      },
    },
  });
  if (error?.status === 429) throw new Error("AUTH_RATE_LIMITED");
  if (error) throw new Error("AUTH_EMAIL_FAILED");
  if (data.session) {
    await client.auth.signOut({ scope: "global" });
    throw new Error("AUTH_EMAIL_CONFIRMATION_REQUIRED");
  }
  // Supabase masque volontairement l'existence d'un compte. Une identité vide
  // reçoit donc exactement la même réponse publique mais n'est jamais liée au brouillon.
  if (data.user?.id && (data.user.identities?.length ?? 1) > 0) {
    await prisma.signupJourney.updateMany({
      where: { id: persisted.id, email, authUserId: null, status: "EMAIL_PENDING" },
      data: { authUserId: data.user.id },
    });
  }
  return { verificationRequired: true as const };
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
    if (!journey || journey.expiresAt <= new Date() || !journey.emailLinkTokenHash ||
        !tokenMatches(input.linkToken, journey.emailLinkTokenHash) ||
        (journey.authUserId !== null && journey.authUserId !== input.authUserId) || journey.email !== email ||
        journey.status === "ACTIVATED") {
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
        alreadyActivated: false,
        welcomeJobId: welcomeJob.id,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (activation.welcomeJobId) kickOperationJob(activation.welcomeJobId);
    return {
      companyId: activation.companyId,
      email: activation.email,
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
  eventKey: string
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
    subject: "Bienvenue sur TutelLiv",
    text: [
      `Bonjour ${user.firstName},`,
      "",
      `Votre espace ${journey.companyName ?? "TutelLiv"} est prêt avec l’offre ${journey.planCode} (${interval}).`,
      "Connectez-vous puis suivez l’assistant pour ajouter vos livreurs, vos clients et créer votre première livraison.",
      "",
      "L’équipe TutelLiv",
    ].join("\n"),
    idempotencyKey: eventKey,
  });
  if (delivery.status === "disabled") {
    throw new Error("SIGNUP_WELCOME_EMAIL_DISABLED");
  }
  return delivery;
}

export async function processFakeSignupPayment(resumeToken: string, input: {
  eventKey: string;
  outcome: "confirmed" | "declined" | "pending";
}) {
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
}\n