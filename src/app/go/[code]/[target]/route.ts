/**
 * ADMIN-ESPACE lot 5 : liens des mails de campagne. `/go/<code>/rejoindre` ouvre le formulaire de la
 * liste d'attente, `/go/<code>/site` l'accueil. Route publique sans cookie ni session. Depuis le
 * 6 novembre 2026, la redirection ne compte plus rien : les antivirus des messageries (Microsoft, Proofpoint,
 * Altospam…) ouvrent chaque lien en se faisant passer pour un navigateur. Le clic est compté par la page
 * d'arrivée, après un geste réel du visiteur. Un lien abîmé mène simplement à l'accueil.
 */
import { NextResponse } from "next/server";
import { FUNNEL_CAMPAIGN_PATTERN, isMailLinkTarget, mailLinkDestination } from "@/domains/growth/waitlist-funnel.service";

const NO_STORE = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ code: string; target: string }> };

async function destination(context: Params): Promise<string> {
  const { code, target } = await context.params;
  if (!FUNNEL_CAMPAIGN_PATTERN.test(code) || !isMailLinkTarget(target)) return "/";
  return mailLinkDestination(code, target);
}

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 302, headers: NO_STORE });
}

export async function GET(request: Request, context: Params) {
  return redirect(request, await destination(context));
}

export async function HEAD(request: Request, context: Params) {
  return redirect(request, await destination(context));
}
