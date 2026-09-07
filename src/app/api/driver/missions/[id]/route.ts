import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { prisma } from "@/services/prisma/client";
import {
  getDriverMissionById,
  updateDeliveryStatusByDriver,
} from "@/domains/delivery/delivery.service";
import { updateDriverDeliveryStatusSchema } from "@/lib/validations/delivery";
import { DriverProximityError } from "@/domains/delivery/driver-proximity.service";
import { uploadPodPhoto } from "@/lib/storage/pod";
import { POD_FAILURE_CODES } from "@/lib/pod/codes";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const mission = await getDriverMissionById(auth.context.user.id, id);

  if (!mission) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: mission, success: true });
}

async function parseDriverStatusPayload(request: Request, deliveryId: string, companyId: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const photo = form.get("photo");
    let podPhotoPath: string | undefined;
    if (photo instanceof File && photo.size > 0) {
      const bytes = Buffer.from(await photo.arrayBuffer());
      podPhotoPath = await uploadPodPhoto({
        companyId,
        deliveryId,
        bytes,
        contentType: photo.type || "image/jpeg",
      });
    }
    const failureRaw = String(form.get("podFailureCode") ?? "");
    return {
      status: String(form.get("status") ?? ""),
      confirmOutOfRange: form.get("confirmOutOfRange") === "true",
      latitude: form.get("latitude") ? Number(form.get("latitude")) : undefined,
      longitude: form.get("longitude") ? Number(form.get("longitude")) : undefined,
      podOutcome: form.get("podOutcome") ? String(form.get("podOutcome")) : undefined,
      podFailureCode: POD_FAILURE_CODES.includes(failureRaw as (typeof POD_FAILURE_CODES)[number])
        ? failureRaw
        : undefined,
      podNote: form.get("podNote") ? String(form.get("podNote")) : undefined,
      podPhotoPath,
    };
  }

  return request.json();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await prisma.delivery.findFirst({
    where: { id, driverId: auth.context.user.id },
    select: { companyId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await parseDriverStatusPayload(request, id, existing.companyId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPLOAD";
    if (message.startsWith("POD_")) {
      return NextResponse.json({ error: "Impossible d'enregistrer la photo." }, { status: 502 });
    }
    throw error;
  }

  const parsed = updateDriverDeliveryStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const mission = await updateDeliveryStatusByDriver(
      auth.context.user.id,
      id,
      parsed.data.status,
      {
        purchaseItems: parsed.data.purchaseItems,
        confirmOutOfRange: parsed.data.confirmOutOfRange,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        podOutcome: parsed.data.podOutcome,
        podFailureCode: parsed.data.podFailureCode,
        podNote: parsed.data.podNote,
        podPhotoPath: parsed.data.podPhotoPath,
      }
    );

    if (!mission) {
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: mission, success: true });
  } catch (error) {
    if (error instanceof DriverProximityError) {
      return NextResponse.json(
        {
          error: "Vous n'êtes pas proche du point attendu",
          code: error.code,
          kind: error.kind,
          distanceMeters: error.distanceMeters,
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "INVALID_PURCHASE_ITEMS") {
      return NextResponse.json({ error: "Articles invalides" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "MISSION_NOT_STARTED") {
      return NextResponse.json(
        { error: "Démarrez d'abord la mission." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "INVALID_STATUS_TRANSITION") {
      return NextResponse.json(
        { error: "Cette étape n'est pas disponible à ce stade de la mission." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "POD_PHOTO_REQUIRED") {
      return NextResponse.json(
        { error: "Une photo de preuve est obligatoire pour clôturer." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "POD_REASON_REQUIRED") {
      return NextResponse.json(
        { error: "Indiquez le motif d'échec." },
        { status: 400 }
      );
    }
    throw error;
  }
}
