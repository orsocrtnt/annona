import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { analyzeOrderMessage } from "@/domains/order-intake/order-intake.service";
import { intakeError, intakeJson, withIntakeErrors } from "../intake-http";

function formatWait(seconds: number) {
  return seconds >= 3600 ? `${Math.ceil(seconds / 3600)} h` : `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

/**
 * Analyse un message collé et rend un brouillon éditable. Rien n'est créé ici.
 * Le message vient d'un tiers : il n'est jamais interprété comme une consigne.
 */
export async function POST(request: Request) {
  return withIntakeErrors(async () => {
    const auth = await requireStaffRole("orders:create");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return intakeError("NO_COMPANY", "Entreprise non associée", 400);

    const body = (await request.json().catch(() => null)) as { text?: unknown; sender?: unknown } | null;
    if (!body || typeof body !== "object") return intakeError("INVALID_MESSAGE", "Collez le message à analyser.", 400);

    // L'entreprise vient de la session ; un companyId du corps est ignoré.
    const result = await analyzeOrderMessage({ companyId, text: body.text, sender: body.sender });
    switch (result.status) {
      case "ok":
        return intakeJson({ success: true, data: result.draft });
      case "disabled":
        return intakeError("INTAKE_DISABLED", CONFIG_MESSAGES.INTAKE_DISABLED, 403);
      case "not_configured":
        return intakeError("INTAKE_NOT_CONFIGURED", CONFIG_MESSAGES.INTAKE_NOT_CONFIGURED, 403);
      case "invalid":
        return intakeError("INVALID_MESSAGE", result.message, 400);
      case "rate_limited":
        return intakeError(
          "QUOTA_REACHED",
          `Quota d'analyses atteint pour votre entreprise. Réessayez dans ${formatWait(result.retryAfterSeconds)} ou saisissez la commande à la main.`,
          429,
          { "Retry-After": String(result.retryAfterSeconds) }
        );
      case "provider_error":
        return intakeError("PROVIDER_ERROR", "L'analyse automatique n'a pas abouti. Réessayez ou saisissez la commande à la main.", 502);
      case "invalid_output":
        return intakeError("INVALID_MODEL_OUTPUT", "Le message n'a pas pu être transformé en brouillon fiable. Saisissez la commande à la main.", 422);
    }
  });
}
