import { type NextRequest, NextResponse } from "next/server";
import { SIGNUP_COOKIE, createSignupJourney, getActiveSignupCatalog, getSignupJourney, submitSignupIdentity, updateSignupSelection } from "@/domains/signup/signup.service";
import { setSignupResumeCookie } from "@/domains/signup/signup-cookie";
import { signupActionSchema } from "@/lib/validations/signup";

const noStore = { "Cache-Control": "no-store" };

function publicError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "AUTH_RATE_LIMITED") return { status: 429, error: "Trop de demandes. Réessayez dans quelques minutes." };
  if (["AUTH_EMAIL_NOT_CONFIGURED", "AUTH_EMAIL_FAILED"].includes(code)) return { status: 503, error: "La vérification e-mail est temporairement indisponible." };
  if (code === "SIGNUP_RESUME_INVALID") return { status: 401, error: "Cette inscription a expiré. Recommencez en quelques instants." };
  if (code.includes("INVALID") || code.includes("EXCEEDED") || code.includes("LOCKED")) return { status: 400, error: "Les choix transmis ne sont pas disponibles pour cette offre." };
  return { status: 502, error: "L'inscription est temporairement indisponible." };
}

export async function GET(request: NextRequest) {
  try {
    const [catalog, journey] = await Promise.all([
      getActiveSignupCatalog(),
      request.cookies.get(SIGNUP_COOKIE)?.value
        ? getSignupJourney(request.cookies.get(SIGNUP_COOKIE)!.value).catch(() => null)
        : Promise.resolve(null),
    ]);
    return NextResponse.json({ catalog, journey }, { headers: noStore });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const parsed = signupActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les informations saisies." }, { status: 400, headers: noStore });
  try {
    const currentToken = request.cookies.get(SIGNUP_COOKIE)?.value;
    if (parsed.data.action === "create") {
      const result = currentToken
        ? { resumeToken: currentToken, journey: await updateSignupSelection(currentToken, parsed.data) }
        : await createSignupJourney(parsed.data);
      const response = NextResponse.json({ journey: result.journey }, { headers: noStore });
      setSignupResumeCookie(response, result.resumeToken);
      return response;
    }
    if (!currentToken) return NextResponse.json({ error: "Cette inscription a expiré." }, { status: 401, headers: noStore });
    if (parsed.data.action === "selection") {
      return NextResponse.json({ journey: await updateSignupSelection(currentToken, parsed.data) }, { headers: noStore });
    }
    const result = await submitSignupIdentity(currentToken, parsed.data);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  }
}\n