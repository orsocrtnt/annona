import { prisma } from "@/services/prisma/client";

export type OnboardingStepKey =
  | "company"
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
}

export interface CompanyOnboardingSnapshot {
  companyName: string;
  companyStatus: "ACTIVE" | "TRIAL" | "INACTIVE" | "SUSPENDED";
  settings: unknown;
  clientCount: number;
  driverCount: number;
  orderCount: number;
  completedDeliveryCount: number;
}

export interface CompanyOnboardingStatus {
  companyName: string;
  completedSteps: number;
  totalSteps: number;
  readyForInternalTest: boolean;
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
  const companyConfigured =
    ["ACTIVE", "TRIAL"].includes(snapshot.companyStatus) &&
    ("deliveryCategories" in settings || "deliveryOptions" in settings);
  const pricingConfigured =
    "billing" in settings || "tariffZones" in settings || "tariffs" in settings;
  const dispatchConfigured =
    "dispatchRules" in settings ||
    "dispatch" in settings ||
    snapshot.completedDeliveryCount > 0;

  const steps: OnboardingStep[] = [
    {
      key: "company",
      title: "Choisir les services proposés",
      description: "Vérifiez les types de commandes visibles par vos clients.",
      href: "/settings",
      action: "Configurer les services",
      complete: companyConfigured,
    },
    {
      key: "client",
      title: "Ajouter un client",
      description:
        snapshot.clientCount > 0
          ? `${snapshot.clientCount} compte(s) client présent(s).`
          : "Ajoutez le client qui créera la première commande test.",
      href: "/users",
      action: "Gérer les comptes",
      complete: snapshot.clientCount > 0,
    },
    {
      key: "driver",
      title: "Ajouter un livreur",
      description:
        snapshot.driverCount > 0
          ? `${snapshot.driverCount} compte(s) livreur présent(s).`
          : "Ajoutez le livreur qui prendra en charge la première mission.",
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
  return {
    companyName: snapshot.companyName,
    completedSteps,
    totalSteps: steps.length,
    readyForInternalTest: completedSteps === steps.length,
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
  const [company, clientCount, driverCount, orderCount, completedDeliveryCount] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, status: true, settings: true },
      }),
      prisma.user.count({
        where: {
          companyId,
          status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
          role: { systemRole: "CLIENT" },
        },
      }),
      prisma.user.count({
        where: {
          companyId,
          status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
          role: { systemRole: "DRIVER" },
        },
      }),
      prisma.order.count({ where: { companyId } }),
      prisma.delivery.count({
        where: { companyId, status: { in: ["DELIVERED", "INVOICED", "PAID"] } },
      }),
    ]);

  if (!company) throw new Error("COMPANY_NOT_FOUND");

  return buildCompanyOnboardingStatus({
    companyName: company.name,
    companyStatus: company.status,
    settings: company.settings,
    clientCount,
    driverCount,
    orderCount,
    completedDeliveryCount,
  });
}
