import type { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { prisma } from "@/services/prisma/client";
import {
  activateManualCommercialSubscription,
  activateManualSubscriptionItem,
} from "@/domains/saas/saas.service";
import {
  OFFER_ENVIRONMENT_PASSWORD,
  OFFER_ENVIRONMENTS,
  type OfferEnvironmentDefinition,
  type OfferEnvironmentKey,
} from "@/domains/saas/offer-environments";

function offerSettings(definition: OfferEnvironmentDefinition): Prisma.InputJsonValue {
  return {
    offerEnvironment: {
      key: definition.key,
      planCode: definition.planCode,
      optionCodes: definition.optionCodes,
    },
  };
}

function createOfferAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("OFFER_SUPABASE_CONFIG_MISSING");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
}

async function ensureAuthUserId(definition: OfferEnvironmentDefinition) {
  const admin = createOfferAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: definition.adminEmail,
    password: OFFER_ENVIRONMENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: definition.adminFirstName,
      last_name: definition.adminLastName,
      account_type: "company",
      company_name: definition.name,
      offer_environment: definition.key,
    },
  });
  if (data.user?.id) return data.user.id;

  const message = error?.message?.toLowerCase() ?? "";
  if (!message.includes("already") && !message.includes("exists") && !message.includes("registered")) {
    throw new Error(error?.message ?? "OFFER_AUTH_USER_FAILED");
  }

  const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = listed.data.users.find(
    (user) => user.email?.toLowerCase() === definition.adminEmail.toLowerCase()
  );
  if (!existing) throw new Error("OFFER_AUTH_USER_MISSING");
  return existing.id;
}

async function syncSubscription(
  companyId: string,
  definition: OfferEnvironmentDefinition,
  now: Date
) {
  const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await activateManualCommercialSubscription({
    companyId,
    planCode: definition.planCode,
    billingInterval: "MONTHLY",
    startsAt: now,
    currentPeriodEnd: periodEnd,
  });

  const subscription = await prisma.saasSubscription.findUnique({
    where: { companyId },
    include: {
      items: {
        where: { effectiveTo: null },
      },
    },
  });
  if (!subscription) throw new Error("SAAS_SUBSCRIPTION_REQUIRED");

  const desired = new Set(definition.optionCodes);
  for (const item of subscription.items) {
    if (!desired.has(item.code)) {
      await prisma.saasSubscriptionItem.update({
        where: { id: item.id },
        data: { effectiveTo: now },
      });
    }
  }

  for (const optionCode of definition.optionCodes) {
    await activateManualSubscriptionItem({
      companyId,
      optionCode,
      quantity: 1,
      effectiveFrom: now,
      source: "INITIAL",
    });
  }
}

export async function provisionOfferEnvironment(definition: OfferEnvironmentDefinition) {
  const now = new Date();
  const authId = await ensureAuthUserId(definition);
  const role = await prisma.role.findUnique({ where: { slug: "company-admin" } });
  if (!role) throw new Error("OFFER_ADMIN_ROLE_MISSING");

  // Écrasement complet des réglages voulu : provisionnement d'un environnement d'offre de test, sans concurrence.
  const company = await prisma.company.upsert({
    where: { slug: definition.slug },
    update: {
      name: definition.name,
      email: definition.adminEmail,
      status: "ACTIVE",
      isDemo: false,
      settings: offerSettings(definition),
    },
    create: {
      name: definition.name,
      slug: definition.slug,
      email: definition.adminEmail,
      status: "ACTIVE",
      isDemo: false,
      country: "FR",
      settings: offerSettings(definition),
    },
  });

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: { equals: definition.adminEmail, mode: "insensitive" } }, { authId }],
    },
  });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        authId,
        email: definition.adminEmail,
        firstName: definition.adminFirstName,
        lastName: definition.adminLastName,
        status: "ACTIVE",
        roleId: role.id,
        companyId: company.id,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        authId,
        email: definition.adminEmail,
        firstName: definition.adminFirstName,
        lastName: definition.adminLastName,
        status: "ACTIVE",
        roleId: role.id,
        companyId: company.id,
      },
    });
  }

  await syncSubscription(company.id, definition, now);
  return { companyId: company.id, email: definition.adminEmail, slug: definition.slug };
}

export async function provisionOfferEnvironments(keys?: OfferEnvironmentKey[]) {
  const selected = keys?.length
    ? OFFER_ENVIRONMENTS.filter((environment) => keys.includes(environment.key))
    : OFFER_ENVIRONMENTS;
  const results = [];
  for (const definition of selected) {
    results.push(await provisionOfferEnvironment(definition));
  }
  return results;
}
