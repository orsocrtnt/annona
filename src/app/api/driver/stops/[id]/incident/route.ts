import { NextResponse } from "next/server";
import { reportStopIncident, type PhotoStore } from "@/domains/round/round-driver.service";
import { ApiRouteError, withApiHandler } from "@/lib/api/route-handler";
import { requireCompanyRole } from "@/lib/api/tenant-auth";
import { fr } from "@/lib/i18n/fr";
import { deletePodPhoto, MAX_POD_BYTES, MAX_POD_REQUEST_BYTES, uploadPodPhoto } from "@/lib/storage/pod";
import { incidentFieldsSchema } from "@/lib/validations/round";

export const runtime = "nodejs";

const t = fr.driverRound.errors;

/** Photos d'incident : bucket privé des preuves, métadonnées (EXIF, GPS) retirées au ré-encodage. */
const photoStore: PhotoStore = {
  async upload({ companyId, stopId, bytes, contentType }) {
    try {
      return await uploadPodPhoto({ companyId, deliveryId: stopId, bytes, contentType });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "POD_PHOTO_TOO_LARGE") throw new ApiRouteError(t.photoTooLarge, 413);
      if (code === "POD_INVALID_PHOTO") throw new ApiRouteError(t.photoInvalid, 400);
      throw error;
    }
  },
  async remove({ companyId, stopId, path }) {
    await deletePodPhoto(path, companyId, stopId);
  },
};

/** LIV-05 : problème signalé (motif, commentaire, photo facultative). Idempotent (LIV-06). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const guard = await requireCompanyRole(["DRIVER"], "stops:update");
    if ("error" in guard) return guard.error;
    const { id } = await params;
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_POD_REQUEST_BYTES) throw new ApiRouteError(t.photoTooLarge, 413);
    const form = await request.formData().catch(() => null);
    if (!form) throw new ApiRouteError("Requête invalide.", 400);
    const fields = incidentFieldsSchema.parse({
      code: form.get("code"),
      comment: form.get("comment") ?? undefined,
      at: form.get("at") || null,
    });
    const file = form.get("photo");
    let photo: { bytes: Buffer; contentType: string } | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_POD_BYTES) throw new ApiRouteError(t.photoTooLarge, 413);
      photo = { bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type };
    }
    const data = await reportStopIncident(
      { companyId: guard.actor.companyId, userId: guard.actor.user.id },
      id,
      { ...fields, photo },
      { photos: photoStore }
    );
    return NextResponse.json({ data, success: true });
  });
}
