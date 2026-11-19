import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { readCakeLeadHours } from "@/domains/shop/cake-order.service";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin } from "@/lib/api/tenant-auth";
import { prisma } from "@/services/prisma/client";

const schema = z.object({ cakeOrderLeadHours: z.number().int("Nombre d'heures entier.").min(0).max(720, "30 jours au plus.") }).strict();

/** Lot 2, demande 9 : délai minimum entre une commande de gâteau et son retrait (48 h par défaut). */
export async function GET() {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:read");
    if ("error" in guard) return guard.error;
    const company = await prisma.company.findUnique({ where: { id: guard.actor.companyId }, select: { settings: true } });
    return NextResponse.json({ data: { cakeOrderLeadHours: readCakeLeadHours(company?.settings) }, success: true });
  });
}

/** Lot 2, demande 9 : l'administrateur règle ce délai. Les autres réglages de l'entreprise sont gardés. */
export async function PUT(request: Request) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("shops:manage");
    if ("error" in guard) return guard.error;
    const { cakeOrderLeadHours } = schema.parse(await readJsonBody(request));
    const company = await prisma.company.findUnique({ where: { id: guard.actor.companyId }, select: { settings: true, updatedAt: true } });
    if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
    const settings = company.settings && typeof company.settings === "object" && !Array.isArray(company.settings) ? company.settings : {};
    // Écriture réclamée : les autres réglages ne sont jamais écrasés par une modification faite en même temps.
    const claim = { expected: company.updatedAt };
    const { count } = await prisma.company.updateMany({
      where: { id: guard.actor.companyId, updatedAt: claim.expected },
      data: { settings: { ...(settings as Record<string, Prisma.JsonValue>), cakeOrderLeadHours } as Prisma.InputJsonValue },
    });
    if (count === 0) return NextResponse.json({ error: "Les réglages ont changé entre-temps : rechargez la page et réessayez." }, { status: 409 });
    await prisma.auditLog.create({
      data: { companyId: guard.actor.companyId, actorId: guard.actor.user.id, entityType: "CompanySettings", entityId: guard.actor.companyId, action: "UPDATE", after: { cakeOrderLeadHours } },
    });
    return NextResponse.json({ data: { cakeOrderLeadHours }, success: true });
  });
}
