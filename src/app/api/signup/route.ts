import { contactSourceFromHeaders } from "@/domains/growth/contact.service";
import { isOverRequestLimit } from "@/lib/security/request-limit";
import { CONFIG_MESSAGES } from "@/lib/config-messages";
import { type NextRequest, NextResponse } from "next/server";
import { SIGNUP_COOKIE, createSignupJourney, getActiveSignupCatalog, getSignupJourney, reopenSignupIdentity, resendSignupConfirmation, submitSignupIdentity, updateSignupIdentityDetails, updateSignupSelection } from "@/domains/signup/signup.service";
import { clearSignupResumeCookie, setSignupResumeCookie } from "@/domains/signup/signup-cookie";
import { SIGNUP_CLOSED_MESSAGE, signupOpen } from "@/domains/signup/signup-availability";
import { describeSignupValidation, signupActionSchema } from "@/lib/validations/signup";

const noStore = { "Cache-Control": "no-store" };

function isResumeInvalid(error: unknown) {
  return error instanceof Error && error.message === "SIGNUP_RESUME_INVALID";
}

function publicError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "SIGNUP_EMAIL_RESEND_COOLDOWN") return { status: 429, error: "Patientez 30 secondes avant de renvoyer l’e-mail." };
  if (code === "SIGNUP_EDIT_IDENTITY_LOCKED") return { status: 409, error: "L’adresse a déjà été confirmée et ne peut plus être modifiée à cette étape." };
  if (code === "SIGNUP_EDIT_IDENTITY_FAILED") return { status: 503, error: "Impossible de rouvrir cette étape pour le moment." };
  if (code === "AUTH_RATE_LIMITED") return { status: 429, error: "Trop de demandes. Réessayez dans quelques minutes." };
  if (["AUTH_EMAIL_NOT_CONFIGURED", "AUTH_EMAIL_FAILED"].includes(code)) return { status: 503, error: CONFIG_MESSAGES.SIGNUP_EMAIL_UNAVAILABLE };
  if (code === "SALES_CODE_INVALID") return { status: 400, error: "Ce code commercial n’est pas reconnu ou n’est plus actif." };
  if (code === "SIGNUP_RESUME_INVALID") return { status: 401, error: "Cette inscription a expiré. Recommencez en quelques instants." };
  if (code.includes("INVALID") || code.includes("EXCEEDED") || code.includes("LOCKED")) return { status: 400, error: "Les choix transmis ne sont pas disponibles pour cette offre." };
  return { status: 502, error: "L'inscription est temporairement indisponible." };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SIGNUP_COOKIE)?.value;
    const catalogPromise = getActiveSignupCatalog();
    let staleResume = false;
    let journey = null;
    if (token) {
      try {
        journey = await getSignupJourney(token);
      } catch (error) {
        if (!isResumeInvalid(error)) throw error;
        staleResume = true;
      }
    }
    const catalog = await catalogPromise;
    const response = NextResponse.json({ catalog, journey, paymentAdapter: process.env.SIGNUP_PAYMENT_ADAPTER === "stripe-sandbox" ? "stripe-sandbox" : "fake" }, { headers: noStore });
    if (staleResume) clearSignupResumeCookie(response);
    return response;
  } catch (error) {
    const result = publicError(error);
    const response = NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    if (isResumeInvalid(error)) clearSignupResumeCookie(response);
    return response;
  }
}

export async function POST(request: NextRequest) {
  if (!signupOpen()) return NextResponse.json({ error: SIGNUP_CLOSED_MESSAGE }, { status: 503, headers: noStore });
  if (await isOverRequestLimit("signup-source", contactSourceFromHeaders(request.headers), 30)) {
    return NextResponse.json({ error: "Trop de demandes. Réessayez dans quelques minutes." }, { status: 429, headers: noStore });
  }
  const parsed = signupActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const details = describeSignupValidation(parsed.error);
    return NextResponse.json({ error: details.summary, fields: details.fields }, { status: 400, headers: noStore });
  }
  try {
    const currentToken = request.cookies.get(SIGNUP_COOKIE)?.value;
    if (parsed.data.action === "create") {
      let result: Awaited<ReturnType<typeof createSignupJourney>>;
      if (currentToken) {
        try {
          result = {
            resumeToken: currentToken,
            journey: await updateSignupSelection(currentToken, parsed.data),
          };
        } catch (error) {
          if (!isResumeInvalid(error)) throw error;
          result = await createSignupJourney(parsed.data);
        }
      } else {
        result = await createSignupJourney(parsed.data);
      }
      const response = NextResponse.json({ journey: result.journey }, { headers: noStore });
      setSignupResumeCookie(response, result.resumeToken);
      return response;
    }
    if (!currentToken) return NextResponse.json({ error: "Cette inscription a expiré." }, { status: 401, headers: noStore });
    if (parsed.data.action === "selection") {
      return NextResponse.json({ journey: await updateSignupSelection(currentToken, parsed.data) }, { headers: noStore });
    }
    if (parsed.data.action === "resend-email") {
      return NextResponse.json(await resendSignupConfirmation(currentToken), { headers: noStore });
    }
    if (parsed.data.action === "edit-identity") {
      return NextResponse.json({ journey: await reopenSignupIdentity(currentToken) }, { headers: noStore });
    }
    if (parsed.data.action === "identity-details") {
      return NextResponse.json({ journey: await updateSignupIdentityDetails(currentToken, parsed.data) }, { headers: noStore });
    }
    const result = await submitSignupIdentity(currentToken, parsed.data);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const result = publicError(error);
    const response = NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
    if (isResumeInvalid(error)) clearSignupResumeCookie(response);
    return response;
  }
}
