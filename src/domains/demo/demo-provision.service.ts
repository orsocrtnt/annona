import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { prisma } from "@/services/prisma/client";
import type { Prisma } from "@prisma/client";
import {
  DEMO_COMPANY_NAME,
  DEMO_COMPANY_SLUG,
  DEMO_DEFAULT_PASSWORD,
  DEMO_LOGIN_EMAIL,
} from "@/lib/demo/constants";
import { DEFAULT_BILLING_SETTINGS } from "@/lib/validations/billing-settings";
import { DEFAULT_DISPATCH_SETTINGS } from "@/lib/validations/dispatch-settings";
import { demoPersonaSeedUsers } from "@/domains/demo/demo-users.service";
import { resetDemoScenario } from "@/domains/demo/demo-scenario.service";

function buildDemoCompanySettings(driverId: string): Prisma.InputJsonValue {
  const billing = {
    ...DEFAULT_BILLING_SETTINGS,
    courier: {
      ...DEFAULT_BILLING_SETTINGS.courier,
      showClientEstimate: true,
    },
    invoice: {
      ...DEFAULT_BILLING_SETTINGS.invoice,
      referencePrefix: "FAC-DEMO",
      footerNote: "Facture de démonstration — données fictives.",
    },
  };

  const dispatch = {
    ...DEFAULT_DISPATCH_SETTINGS,
    enabled: true,
    allowDriverSelfClaim: true,
    autoAssignCategories: {
      STANDARD: true,
      COURIER: true,
      SPECIAL_MISSION: false,
    },
    driverRules: [
      {
        driverId,
        priority: 1,
        allowedCategories: {
          STANDARD: true,
          COURIER: true,
          SPECIAL_MISSION: false,
        },
        zoneIds: [],
        postalCodePrefixes: ["75", "92", "93", "94"],
        dispatchStatus: "ACTIVE",
      },
    ],
    defaultDriverId: driverId,
  };

  return {
    billing,
    dispatch,
    deliveryOptions: {
      deliveryCategories: {
        STANDARD: true,
        COURIER: true,
        SPECIAL_MISSION: true,
      },
    },
    tariffs: {
      tariffZones: [
        {
          id: "zone-paris",
          name: "Paris intra-muros",
          postalCodePrefixes: ["75"],
          price: 12,
        },
        {
          id: "zone-petite-couronne",
          name: "Petite couronne",
          postalCodePrefixes: ["92", "93", "94"],
          price: 18,
        },
      ],
      tariffFees: [
        {
          id: "fee-express",
          name: "Express",
          price: 8,
          description: "Livraison prioritaire",
        },
      ],
    },
  } as Prisma.InputJsonValue;
}

async function ensureSupabaseDemoUser(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as never },
  });
  const normalizedEmail = DEMO_LOGIN_EMAIL.toLowerCase();

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw new Error(`Supabase listUsers: ${listError.message}`);

  const existing = listed?.users.find(
    (user) => user.email?.toLowerCase() === normalizedEmail
  );
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: DEMO_DEFAULT_PASSWORD,
      user_metadata: {
        first_name: "Alex",
        last_name: "Démo",
        account_type: "company",
      },
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: DEMO_DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: "Alex",
      last_name: "Démo",
      account_type: "company",
    },
  });

  if (error || !data.user) {
    throw new Error(`Supabase createUser: ${error?.message ?? "échec"}`);
  }

  return data.user.id;
}

export async function provisionDemoEnvironment(): Promise<{
  companyId: string;
  loginEmail: string;
  password: string;
}> {
  const authId = await ensureSupabaseDemoUser();

  const company = await prisma.company.upsert({
    where: { slug: DEMO_COMPANY_SLUG },
    update: {
      name: DEMO_COMPANY_NAME,
      isDemo: true,
      status: "ACTIVE",
      email: "contact@logiexpress-demo.fr",
      city: "Paris",
      country: "FR",
    },
    create: {
      name: DEMO_COMPANY_NAME,
      slug: DEMO_COMPANY_SLUG,
      isDemo: true,
      status: "ACTIVE",
      email: "contact@logiexpress-demo.fr",
      city: "Paris",
      country: "FR",
    },
  });

  const seedUsers = demoPersonaSeedUsers(company.id);
  const roleSlugs = [...new Set(seedUsers.map((u) => u.roleSlug))];
  const roles = await prisma.role.findMany({
    where: { slug: { in: roleSlugs } },
  });
  const roleBySlug = new Map(roles.map((role) => [role.slug, role]));

  for (const seed of seedUsers) {
    const role = roleBySlug.get(seed.roleSlug);
    if (!role) throw new Error(`Rôle ${seed.roleSlug} introuvable — lancez npm run db:seed`);

    const resolvedAuthId = seed.persona === "admin" ? authId : seed.authId!;
    await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        authId: resolvedAuthId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        roleId: role.id,
        companyId: company.id,
        status: "ACTIVE",
      },
      create: {
        authId: resolvedAuthId,
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        roleId: role.id,
        companyId: company.id,
        status: "ACTIVE",
      },
    });
  }

  const driver = await prisma.user.findFirst({
    where: { companyId: company.id, email: seedUsers.find((u) => u.persona === "driver")!.email },
    select: { id: true },
  });
  if (!driver) throw new Error("DEMO_DRIVER_MISSING");

  await prisma.company.update({
    where: { id: company.id },
    data: { settings: buildDemoCompanySettings(driver.id) },
  });

  await resetDemoScenario(company.id);

  return {
    companyId: company.id,
    loginEmail: DEMO_LOGIN_EMAIL,
    password: DEMO_DEFAULT_PASSWORD,
  };
}
