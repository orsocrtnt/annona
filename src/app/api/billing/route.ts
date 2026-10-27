import { z } from "zod";
import { NextResponse } from "next/server";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { prisma } from "@/services/prisma/client";
import { sandboxBilling } from "@/domains/billing/billing.service";
import { getActiveSignupCatalog } from "@/domains/signup/signup.service";
import { makeBillingContract, type BillingState } from "@/domains/billing/billing-core";
import { assessBillingContractChange } from "@/domains/billing/plan-change.service";

const selection = z.object({ planCode: z.enum(["STARTER", "PRO", "BUSINESS"]), billingInterval: z.enum(["MONTHLY", "ANNUAL"]), selections: z.array(z.object({ code: z.string().min(1).max(80), quantity: z.number().int().min(1).max(500) }).strict()).max(30) }).strict();
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), selection }).strict(),
  z.object({ action: z.literal("change"), selection, key: z.string().min(8).max(160), prorationDate: z.number().int(), confirmedTotalCents: z.number().int().min(0).max(99_999_999), confirmed: z.literal(true) }).strict(),
  z.object({ action: z.literal("cancel"), key: z.string().min(8).max(160), confirmed: z.literal(true) }).strict(),
]);
async function context() {
  const auth = await requireStaffRole("settings:read");
  if ("error" in auth) return auth;
  const error = requireRole(auth.context, ["COMPANY_ADMIN"]);
  if (error) return { error };
  const companyId = getCompanyId(auth.context);
  if (!companyId) return { error: NextResponse.json({ error: "Entreprise absente" }, { status: 403 }) };
  const account = await prisma.saasBillingAccount.findFirst({ where: { subscription: { companyId } } });
  if (!account) return { error: NextResponse.json({ error: "Abonnement sandbox absent" }, { status: 404 }) };
  return { account, companyId, actorId: auth.context.user.id };
}
export async function GET() {
  const auth = await context();
  if ("error" in auth) return auth.error;
  const operations = await prisma.saasBillingOperation.findMany({ where: { accountId: auth.account.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, kind: true, status: true, createdAt: true, completedAt: true } });
  return NextResponse.json({ state: auth.account.state, operations }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const auth = await context();
  if ("error" in auth) return auth.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Demande invalide" }, { status: 400 });
  try {
    const billing = sandboxBilling(), input = parsed.data;
    if (input.action === "cancel") {
      const result = await billing.command(auth.account.id, input.key, { kind: "CANCEL", actorId: auth.actorId });
      await billing.reconcile(auth.account.id);
      return NextResponse.json(result);
    }
    const catalog = await getActiveSignupCatalog();
    const target = makeBillingContract(catalog, input.selection.planCode, input.selection.billingInterval, input.selection.selections);
    const current = (auth.account.state as unknown as BillingState | null)?.activeContract;
    if (!current) return NextResponse.json({ error: "Abonnement non actif" }, { status: 409 });
    // Décision C10 : comptes en excès pour la cible = refus immédiat, avant tout appel fournisseur.
    const assessment = await assessBillingContractChange(auth.companyId, current, target);
    if (input.action === "preview") return NextResponse.json({ ...await billing.preview(auth.account.id, target, Math.floor(Date.now() / 1000)), quote: target.quote, assessment });
    if (assessment.blockers.length > 0) {
      return NextResponse.json({
        error: "Changement impossible : désactivez d'abord les comptes en excès pour la formule choisie.",
        code: "PLAN_CHANGE_SEATS_EXCEEDED",
        blockers: assessment.blockers,
      }, { status: 409 });
    }
    const result = await billing.command(auth.account.id, input.key, { kind: "CHANGE", target, prorationDate: input.prorationDate, confirmedTotalCents: input.confirmedTotalCents, actorId: auth.actorId });
    await billing.reconcile(auth.account.id);
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: "Modification non appliquée ou en attente de rapprochement. Relisez l’historique avant de réessayer avec la même demande." }, { status: 409 }); }
}
