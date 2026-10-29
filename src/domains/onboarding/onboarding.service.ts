import { z } from "zod";
import { prisma } from "@/services/prisma/client";
import { settingsSection } from "@/lib/database/claimed-settings-update";
import { updateCompanySettingsWithClaim } from "@/lib/database/settings-claims";
import { companyDeliveryOptionsSchema } from "@/lib/validations/company-settings";
import { companyBillingSettingsSchema } from "@/lib/validations/billing-settings";
import { companyDispatchSettingsSchema } from "@/lib/validations/dispatch-settings";

export type OnboardingStepKey =
  | "company"
  | "services"
  | "collaborators"
  | "client"
  | "driver"
  | "pricing"
  | "dispatch"
  | "firstOrder"
  | "firstDelivery";

export interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  action: string;
  complete: boolean;
  optional?: boolean;
  skipped?: boolean;
}

export const onboardingCompanyProfileSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de l’entreprise (2 caractères minimum).").max(160),
  email: z.string().trim().email("Indiquez une adresse e-mail professionnelle valide.").max(254),
  phone: z.string().trim().max(30).default(""),
  address: z.string().trim().min(5, "Indiquez l’adresse de l’entreprise (5 caractères minimum).").max(240),
  city: z.string().trim().min(2, "Indiquez la ville.").max(120),
  country: z.string().trim().length(2, "Le pays s’écrit en deux lettres.").toUpperCase(),
}).strict();

export type OnboardingCompanyProfile = z.infer<typeof onboardingCompanyProfileSchema>;

export interface CompanyOnboardingSnapshot {
  companyName: string;
  companyProfile?: Partial<OnboardingCompanyProfile>;
  companyStatus: "ACTIVE" | "TRIAL" | "INACTIVE" | "SUSPENDED";
  settings: unknown;
  collaboratorCount?: number;
  pendingClientCount?: number;
  pendingDriverCount?: number;
  pendingCollaboratorCount?: number;
  clientCount: number;
  driverCount: number;
  orderCount: number;
  completedDeliveryCount: number;
}

export interface CompanyOnboardingStatus {
  companyName: string;
  companyProfile: OnboardingCompanyProfile;
  completedSteps: number;
  skippedSteps: number;
  totalSteps: number;
  readyForInternalTest: boolean;
  /** Masqué de la navigation principale par l'administrateur (le guide reste accessible depuis l'Aide). */
  hiddenFromNavigation: boolean;
  /** Proposé dans la navigation principale : ni terminé, ni masqué. */
  showInNavigation: boolean;
  steps: OnboardingStep[];
  limits: {
    invitationEmailValidated: false;
    initialImportAvailable: false;
  };
}

function asSettings(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildCompanyOnboardingStatus(
  snapshot: CompanyOnboardingSnapshot
): CompanyOnboardingStatus {
  const settings = asSettings(snapshot.settings);
  const profile = {
    name: snapshot.companyName, email: "", phone: "", address: "", city: "", country: "FR",
    ...snapshot.companyProfile,
  };
  const profileComplete = onboardingCompanyProfileSchema.safeParse(profile).success;
  const companyConfigured =
    ["ACTIVE", "TRIAL"].includes(snapshot.companyStatus) &&
    companyDeliveryOptionsSchema.safeParse(settings).success;
  const pricingConfigured =
    companyBillingSettingsSchema.safeParse(settings.billing).success;
  const dispatchConfigured =
    companyDispatchSettingsSchema.safeParse(settings.dispatchRules).success ||
    snapshot.completedDeliveryCount > 0;

  const onboardingSettings = asSettings(settings.onboarding);
  const skipped = onboardingSettings.skippedCollaborators === true;
  const hiddenFromNavigation = onboardingSettings.hiddenFromNavigation === true;
  const pending = (count: number | undefined) => count ? ` ${count} invitation(s) en attente d’activation.` : "";

  const steps: OnboardingStep[] = [
    {
      key: "company",
      title: "Vérifier les informations entreprise",
      description: "Confirmez le nom et les coordonnées de votre entreprise.",
      href: "/onboarding#company-profile",
      action: "Compléter les informations",
      complete: profileComplete,
    },
    {
      key: "services",
      title: "Choisir les services proposés",
      description: "Vérifiez les types de commandes visibles par vos clients.",
      href: "/settings",
      action: "Configurer les services",
      complete: companyConfigured,
    },
    {
      key: "collaborators",
      title: "Inviter des collaborateurs autorisés",
      description: `${snapshot.collaboratorCount ?? 0} collaborateur(s) actif(s).${pending(snapshot.pendingCollaboratorCount)} Cette étape est facultative si vous travaillez seul.`,
      href: "/users",
      action: "Gérer les collaborateurs",
      complete: (snapshot.collaboratorCount ?? 0) > 0,
      optional: true,
      skipped: skipped && !(snapshot.collaboratorCount ?? 0),
    },
    {
      key: "client",
      title: "Ajouter un client",
      description:
        snapshot.clientCount > 0
          ? `${snapshot.clientCount} compte(s) client actif(s).`
          : `Ajoutez le client qui créera la première commande test.${pending(snapshot.pendingClientCount)}`,
      href: "/users",
      action: "Gérer les comptes",
      complete: snapshot.clientCount > 0,
    },
    {
      key: "driver",
      title: "Ajouter un livreur",
      description:
        snapshot.driverCount > 0
          ? `${snapshot.driverCount} compte(s) livreur actif(s).`
          : `Ajoutez le livreur qui prendra en charge la première mission.${pending(snapshot.pendingDriverCount)}`,
      href: "/users",
      action: "Gérer les comptes",
      complete: snapshot.driverCount > 0,
    },
    {
      key: "pricing",
      title: "Vérifier les tarifs utiles",
      description: "Contrôlez au minimum le tarif des courses et les zones réellement utilisées.",
      href: "/settings/billing",
      action: "Vérifier les tarifs",
      complete: pricingConfigured,
    },
    {
      key: "dispatch",
      title: "Préparer le dispatch",
      description: "Reliez les livreurs aux catégories et zones avant la première affectation.",
      href: "/dispatch",
      action: "Configurer le dispatch",
      complete: dispatchConfigured && snapshot.driverCount > 0,
    },
    {
      key: "firstOrder",
      title: "Recevoir la première commande test",
      description:
        snapshot.orderCount > 0
          ? `${snapshot.orderCount} commande(s) déjà créée(s).`
          : "Connectez-vous avec le compte client et créez une commande fictive.",
      href: "/dashboard/orders",
      action: "Voir les commandes",
      complete: snapshot.orderCount > 0,
    },
    {
      key: "firstDelivery",
      title: "Terminer la première livraison test",
      description:
        snapshot.completedDeliveryCount > 0
          ? `${snapshot.completedDeliveryCount} livraison(s) terminée(s).`
          : "Affectez, faites accepter puis terminez la mission avec une preuve fictive.",
      href: "/dispatch",
      action: "Ouvrir le dispatch",
      complete: snapshot.completedDeliveryCount > 0,
    },
  ];

  const completedSteps = steps.filter((step) => step.complete).length;
  const readyForInternalTest = steps.every((step) => step.complete || step.skipped);
  return {
    companyName: snapshot.companyName,
    companyProfile: profile,
    completedSteps,
    skippedSteps: steps.filter((step) => step.skipped).length,
    totalSteps: steps.length,
    readyForInternalTest,
    hiddenFromNavigation,
    showInNavigation: !readyForInternalTest && !hiddenFromNavigation,
    steps,
    limits: {
      invitationEmailValidated: false,
      initialImportAvailable: false,
    },
  };
}

export async function getCompanyOnboardingStatus(
  companyId: string
): Promise<CompanyOnboardingStatus> {
  const [company, accounts, orderCount, completedDeliveryCount] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, email: true, phone: true, address: true, city: true, country: true, status: true, settings: true },
      }),
      prisma.user.groupBy({
        by: ["roleId", "status"],
        where: { companyId, status: { in: ["ACTIVE", "PENDING_VERIFICATION"] } },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { companyId } }),
      prisma.delivery.count({
        where: { companyId, status: { in: ["DELIVERED", "INVOICED", "PAID"] } },
      }),
    ]);

  if (!company) throw new Error("COMPANY_NOT_FOUND");

  const roles = await prisma.role.findMany({
    where: { systemRole: { in: ["CLIENT", "DRIVER", "MINI_ADMIN", "DISPATCHER"] } },
    select: { id: true, systemRole: true },
  });
  const count = (systemRoles: string[], status: string) => accounts.reduce((total, account) =>
    account.status === status && roles.some((role) => role.id === account.roleId && systemRoles.includes(role.systemRole))
      ? total + account._count._all : total, 0);

  return buildCompanyOnboardingStatus({
    companyName: company.name,
    companyProfile: { name: company.name, email: company.email ?? "", phone: company.phone ?? "", address: company.address ?? "", city: company.city ?? "", country: company.country ?? "FR" },
    companyStatus: company.status,
    settings: company.settings,
    clientCount: count(["CLIENT"], "ACTIVE"),
    driverCount: count(["DRIVER"], "ACTIVE"),
    collaboratorCount: count(["MINI_ADMIN", "DISPATCHER"], "ACTIVE"),
    pendingClientCount: count(["CLIENT"], "PENDING_VERIFICATION"),
    pendingDriverCount: count(["DRIVER"], "PENDING_VERIFICATION"),
    pendingCollaboratorCount: count(["MINI_ADMIN", "DISPATCHER"], "PENDING_VERIFICATION"),
    orderCount,
    completedDeliveryCount,
  });
}

// Seuls le choix facultatif et l'affichage dans la navigation s'enregistrent ; les étapes métier restent calculées.
export const onboardingPreferenceSchema = z.union([
  z.object({ step: z.literal("collaborators"), skipped: z.boolean() }).strict(),
  z.object({ step: z.literal("navigation"), hidden: z.boolean() }).strict(),
]);

export async function updateOnboardingPreference(companyId: string, input: unknown) {
  const preference = onboardingPreferenceSchema.parse(input);
  const change = preference.step === "collaborators"
    ? { skippedCollaborators: preference.skipped }
    : { hiddenFromNavigation: preference.hidden };
  // Réclamation sur updatedAt (RECETTE-2810, point 16) : les autres réglages ne sont jamais écrasés ;
  // un enregistrement concurrent du même choix d'onboarding donne un conflit (409).
  let result: "saved" | "missing";
  try {
    result = await updateCompanySettingsWithClaim(companyId, {
      apply: (settings) => ({
        ...settings,
        onboarding: { ...asSettings(settings.onboarding), ...change },
      }),
      // Seule la clé modifiée compte : masquer la navigation et passer les collaborateurs ne se gênent pas.
      section: settingsSection("onboarding", Object.keys(change)[0]!),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SETTINGS_CONFLICT") throw new Error("ONBOARDING_CONFLICT");
    throw error;
  }
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");
}

export async function updateOnboardingCompanyProfile(companyId: string, input: unknown) {
  const profile = onboardingCompanyProfileSchema.parse(input);
  const updated = await prisma.company.updateMany({ where: { id: companyId }, data: profile });
  if (updated.count !== 1) throw new Error("COMPANY_NOT_FOUND");
}

export async function resolveOnboardingLoginPath(
  user: { companyId?: string | null; role: { systemRole: string }; settings?: unknown },
  defaultPath: string
): Promise<string> {
  if (user.role.systemRole !== "COMPANY_ADMIN" || !user.companyId ||
      asSettings(user.settings).onboardingRequired !== true) return defaultPath;
  const status = await getCompanyOnboardingStatus(user.companyId);
  // Masqué par l'administrateur : il n'est plus proposé à la connexion ; l'Aide permet de le reprendre.
  return status.showInNavigation ? "/onboarding" : defaultPath;
}
