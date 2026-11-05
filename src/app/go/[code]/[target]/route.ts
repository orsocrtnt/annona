/**
 * ADMIN-ESPACE lot 5 : liens des mails de campagne. `/go/<code>/rejoindre` ouvre le formulaire de la
 * liste d'attente, `/go/<code>/site` l'accueil ; le clic est compté par jour et par campagne avant la
 * redirection. Route publique sans cookie ni session ; seule une requête GET est comptée (les
 * vérifications HEAD des messageries ne comptent pas). Un lien abîmé mène simplement à l'accueil.
 */
import { NextResponse } from "next/server";
import { contactSourceFromHeaders } from "@/domains/growth/contact.service";
import {
  FUNNEL_CAMPAIGN_PATTERN,
  isMailLinkTarget,
  mailLinkDestination,
  recordMailLinkClick,
} from "@/domains/growth/waitlist-funnel.service";

const NO_STORE = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ code: string; target: string }> };

async function resolve(context: Params) {
  const { code, target } = await context.params;
  if (!FUNNEL_CAMPAIGN_PATTERN.test(code) || !isMailLinkTarget(target)) return null;
  return { code, target };
}

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 302, headers: NO_STORE });
}

export async function GET(request: Request, context: Params) {
  const link = await resolve(context);
  if (!link) return redirect(request, "/");
  try {
    await recordMailLinkClick(link.code, link.target, {
      userAgent: request.headers.get("user-agent"),
      source: contactSourceFromHeaders(request.headers),
    });
  } catch (error) {
    // Le visiteur arrive toujours sur la page, même si le compteur est indisponible.
    console.error("Mail link count failed:", error instanceof Error ? error.message : "unknown");
  }
  return redirect(request, mailLinkDestination(link.code, link.target));
}

export async function HEAD(request: Request, context: Params) {
  const link = await resolve(context);
  return redirect(request, link ? mailLinkDestination(link.code, link.target) : "/");
}
