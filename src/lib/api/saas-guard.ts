import { NextResponse } from "next/server";
import { resolveCompanySaasAccess } from "@/domains/saas/saas.service";
import { prisma } from "@/services/prisma/client";

/** Abonnement expiré ou impayé : l'équipe consulte, mais ne modifie plus (AUDIT-0111, C4). */
export async function refuseIfReadOnly(companyId: string, resolve = resolveCompanySaasAccess) {
  let access: Awaited<ReturnType<typeof resolve>>;
  try {
    access = await resolve(companyId);
  } catch (error) {
    // Sans abonnement, la lecture seule n'est pas établie : le contrôle métier suivant décide.
    if (error instanceof Error && error.message === "SAAS_SUBSCRIPTION_REQUIRED") return null;
    throw error;
  }
  if (access.canMutate) return null;
  return NextResponse.json({ error: "Ce compte est actuellement en lecture seule." }, { status: 403 });
}

/** Le mot de passe de démo est public : personne ne doit pouvoir écrire à une adresse depuis Annona (AUDIT-0111, S3). */
export async function refuseDemoInvitation(companyId: string | null | undefined) {
  if (!companyId) return null;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { isDemo: true } });
  if (!company?.isDemo) return null;
  return NextResponse.json({ error: "Les invitations sont désactivées dans la démonstration." }, { status: 403 });
}
