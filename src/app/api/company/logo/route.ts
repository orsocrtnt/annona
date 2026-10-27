import { NextResponse } from "next/server";
import { getCompanyId, requireAuth, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import {
  companyHasLogo,
  readCompanyLogo,
  removeCompanyLogo,
  setCompanyLogo,
} from "@/domains/company/company-logo.service";
import { MAX_LOGO_UPLOAD_BYTES } from "@/lib/storage/company-logo";

export const runtime = "nodejs";

const LOGO_ERRORS: Record<string, { status: number; error: string }> = {
  LOGO_DEMO_DISABLED: { status: 403, error: "Le logo n’est pas modifiable dans l’environnement de démonstration." },
  LOGO_TOO_LARGE: { status: 413, error: "Logo trop lourd : 2 Mo maximum." },
  LOGO_INVALID_IMAGE: { status: 400, error: "Format non pris en charge : envoyez une image PNG, JPEG ou WebP." },
  LOGO_COMPANY_NOT_FOUND: { status: 404, error: "Entreprise introuvable" },
};

function logoError(error: unknown) {
  const known = error instanceof Error ? LOGO_ERRORS[error.message] : undefined;
  if (known) return NextResponse.json({ error: known.error }, { status: known.status });
  console.error("[company-logo]", error);
  return NextResponse.json({ error: "Impossible d’enregistrer le logo pour le moment." }, { status: 500 });
}

/** Envoi et retrait : admin et mini-admin uniquement. */
async function requireLogoEditor() {
  const auth = await requireStaffRole("settings:update");
  if ("error" in auth) return { error: auth.error };
  const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
  if (denied) return { error: denied };
  const companyId = getCompanyId(auth.context);
  if (!companyId) return { error: NextResponse.json({ error: "Entreprise non associée" }, { status: 400 }) };
  return { companyId };
}

/**
 * Logo de l'entreprise de l'utilisateur connecté (équipe, client ou chauffeur), servi en privé.
 * `?meta=1` : seulement `{ hasLogo }`, pour ne demander l'image que si elle existe.
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const companyId = getCompanyId(auth.context);
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });

  if (new URL(request.url).searchParams.has("meta")) {
    return NextResponse.json({ data: { hasLogo: await companyHasLogo(companyId) }, success: true });
  }

  const png = await readCompanyLogo(companyId);
  if (!png) return NextResponse.json({ error: "Aucun logo" }, { status: 404 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request) {
  const editor = await requireLogoEditor();
  if ("error" in editor) return editor.error;

  const requestLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(requestLength) && requestLength > MAX_LOGO_UPLOAD_BYTES + 64 * 1024) {
    return logoError(new Error("LOGO_TOO_LARGE"));
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File) || file.size === 0) return logoError(new Error("LOGO_INVALID_IMAGE"));
  if (file.size > MAX_LOGO_UPLOAD_BYTES) return logoError(new Error("LOGO_TOO_LARGE"));

  try {
    const size = await setCompanyLogo(editor.companyId, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ data: size, success: true });
  } catch (error) {
    return logoError(error);
  }
}

export async function DELETE() {
  const editor = await requireLogoEditor();
  if ("error" in editor) return editor.error;
  try {
    await removeCompanyLogo(editor.companyId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return logoError(error);
  }
}
