import { prisma } from "@/services/prisma/client";
import {
  deleteCompanyLogoFile,
  downloadCompanyLogo,
  isCompanyLogoPath,
  normalizeCompanyLogo,
  uploadCompanyLogo,
} from "@/lib/storage/company-logo";

/**
 * Logo affiché en tête des factures. Désactivé pour les espaces démo : le pool refuse de recycler
 * une entreprise qui référence un fichier externe (`logoUrl`), et la démo doit rester recyclable.
 */
async function companyForLogo(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, isDemo: true, logoUrl: true },
  });
  if (!company) throw new Error("LOGO_COMPANY_NOT_FOUND");
  if (company.isDemo) throw new Error("LOGO_DEMO_DISABLED");
  return company;
}

export async function setCompanyLogo(companyId: string, bytes: Buffer) {
  const company = await companyForLogo(companyId);
  const { png, width, height } = await normalizeCompanyLogo(bytes);
  const path = await uploadCompanyLogo(companyId, png);
  try {
    await prisma.company.update({ where: { id: companyId }, data: { logoUrl: path } });
  } catch (error) {
    // Rien de référencé : le fichier tout juste envoyé ne doit pas rester orphelin.
    await deleteCompanyLogoFile(path, companyId).catch(() => undefined);
    throw error;
  }
  if (isCompanyLogoPath(company.logoUrl, companyId) && company.logoUrl !== path) {
    await deleteCompanyLogoFile(company.logoUrl, companyId).catch((error) =>
      console.warn("[company-logo] Ancien logo non supprimé", error)
    );
  }
  return { width, height };
}

export async function removeCompanyLogo(companyId: string) {
  const company = await companyForLogo(companyId);
  if (!company.logoUrl) return;
  await prisma.company.update({ where: { id: companyId }, data: { logoUrl: null } });
  if (isCompanyLogoPath(company.logoUrl, companyId)) {
    await deleteCompanyLogoFile(company.logoUrl, companyId).catch((error) =>
      console.warn("[company-logo] Logo retiré mais fichier non supprimé", error)
    );
  }
}

/** Présence d'un logo, sans télécharger le fichier (affichage conditionnel côté interface). */
export async function companyHasLogo(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { logoUrl: true } });
  return isCompanyLogoPath(company?.logoUrl, companyId);
}

/** PNG du logo de l'entreprise, ou null (aucun logo, espace démo, fichier illisible). */
export async function readCompanyLogo(companyId: string): Promise<Buffer | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { logoUrl: true },
  });
  return company?.logoUrl ? downloadCompanyLogo(company.logoUrl, companyId) : null;
}
