import { NextResponse } from "next/server";
import { readProductPhoto, removeProductPhoto, setProductPhoto } from "@/domains/catalog/catalog.service";
import { withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyAdmin, requireCompanyMember } from "@/lib/api/tenant-auth";
import { fr } from "@/lib/i18n/fr";
import { MAX_PRODUCT_PHOTO_UPLOAD_BYTES } from "@/lib/storage/product-photo";

export const runtime = "nodejs";

const PHOTO_ERRORS: Record<string, { status: number; error: string }> = {
  PHOTO_TOO_LARGE: { status: 413, error: fr.catalog.errors.photoTooLarge },
  PHOTO_INVALID_IMAGE: { status: 400, error: fr.catalog.errors.photoInvalid },
};

function photoError(error: unknown) {
  const known = error instanceof Error ? PHOTO_ERRORS[error.message] : undefined;
  if (known) return NextResponse.json({ error: known.error, success: false }, { status: known.status });
  throw error;
}

/** Photo d'un produit (CLI-03), servie en privé aux utilisateurs de la même entreprise (PLA-01). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyMember("catalog:read");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const photo = await readProductPhoto(guard.actor.companyId, id);
    if (!photo) return NextResponse.json({ error: "Aucune photo", success: false }, { status: 404 });
    return new NextResponse(new Uint8Array(photo), {
      headers: {
        "Content-Type": "image/webp",
        // L'URL porte la version de la photo (?v=…) : une nouvelle photo change d'URL.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

/** ADM-02 : envoyer ou remplacer la photo (administrateur seulement). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_PRODUCT_PHOTO_UPLOAD_BYTES + 64 * 1024) return photoError(new Error("PHOTO_TOO_LARGE"));
    const form = await request.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File) || file.size === 0) return photoError(new Error("PHOTO_INVALID_IMAGE"));
    if (file.size > MAX_PRODUCT_PHOTO_UPLOAD_BYTES) return photoError(new Error("PHOTO_TOO_LARGE"));
    try {
      const data = await setProductPhoto(guard.actor.companyId, id, Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({ data, success: true });
    } catch (error) {
      return photoError(error);
    }
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyAdmin("catalog:manage");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    await removeProductPhoto(guard.actor.companyId, id);
    return NextResponse.json({ success: true });
  });
}
