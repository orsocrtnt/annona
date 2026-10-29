import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { prisma } from "@/services/prisma/client";
import {
  getDriverMissionById,
  updateDeliveryStatusByDriver,
} from "@/domains/delivery/delivery.service";
import { updateDriverDeliveryStatusSchema } from "@/lib/validations/delivery";
import { DriverProximityError } from "@/domains/delivery/driver-proximity.service";
import {
  cleanupPodPhotoOrphans,
  deletePodPhoto,
  MAX_POD_BYTES,
  MAX_POD_REQUEST_BYTES,
  uploadPodPhoto,
  validatePodPhoto,
} from "@/lib/storage/pod";
import { POD_FAILURE_CODES } from "@/lib/pod/codes";
import {
  deletePodSignature,
  MAX_SIGNATURE_BYTES,
  uploadPodSignature,
  validatePodSignature,
} from "@/lib/storage/pod-signature";
import {
  assertPodEvidence,
  withoutSignaturePath,
  isPodEvidenceError,
  POD_EVIDENCE_MESSAGES,
} from "@/domains/delivery/pod-evidence";
import { getCompanyProofRules } from "@/domains/delivery/proof-settings.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;
  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });

  const { id } = await params;
  const mission = await getDriverMissionById(auth.context.user.id, companyId, id);

  if (!mission) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  const { podPhotoPath, ...safeMissionWithSignature } = mission;
    const safeMission = withoutSignaturePath(safeMissionWithSignature);
  return NextResponse.json({
    data: {
      ...safeMission,
      podPhotoUrl: driverProofUrl(podPhotoPath, mission.id),
    },
    success: true,
  });
}

/** Lien interne : l'URL signée (5 minutes) est générée par `/proof` au moment de l'affichage. */
function driverProofUrl(path: string | null | undefined, deliveryId: string) {
  return path ? `/api/driver/missions/${encodeURIComponent(deliveryId)}/proof` : null;
}

async function parseDriverStatusPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const requestLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(requestLength) && requestLength > MAX_POD_REQUEST_BYTES) {
      throw new Error("POD_PHOTO_TOO_LARGE");
    }
    const form = await request.formData();
    const photo = form.get("photo");
    let podPhoto: { bytes: Buffer; contentType: string } | undefined;
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > MAX_POD_BYTES) throw new Error("POD_PHOTO_TOO_LARGE");
      const bytes = Buffer.from(await photo.arrayBuffer());
      const photoContentType = photo.type || "application/octet-stream";
      validatePodPhoto(bytes, photoContentType);
      podPhoto = { bytes, contentType: photoContentType };
    }
    const signature = form.get("signature");
    let podSignature: { bytes: Buffer; contentType: string } | undefined;
    if (signature instanceof File && signature.size > 0) {
      if (signature.size > MAX_SIGNATURE_BYTES) throw new Error("POD_SIGNATURE_TOO_LARGE");
      const bytes = Buffer.from(await signature.arrayBuffer());
      const signatureType = signature.type || "application/octet-stream";
      validatePodSignature(bytes, signatureType);
      podSignature = { bytes, contentType: signatureType };
    }
    const failureRaw = String(form.get("podFailureCode") ?? "");
    return {
      input: {
        status: String(form.get("status") ?? ""),
        confirmOutOfRange: form.get("confirmOutOfRange") === "true",
        latitude: form.get("latitude") ? Number(form.get("latitude")) : undefined,
        longitude: form.get("longitude") ? Number(form.get("longitude")) : undefined,
        podOutcome: form.get("podOutcome") ? String(form.get("podOutcome")) : undefined,
        podFailureCode: POD_FAILURE_CODES.includes(failureRaw as (typeof POD_FAILURE_CODES)[number])
          ? failureRaw
          : undefined,
        podNote: form.get("podNote") ? String(form.get("podNote")) : undefined,
        podRecipientName: form.get("podRecipientName") ? String(form.get("podRecipientName")) : undefined,
        podSignatureRefusedReason: form.get("podSignatureRefusedReason")
          ? String(form.get("podSignatureRefusedReason"))
          : undefined,
      },
      podPhoto,
      podSignature,
    };
  }

  const body: unknown = await request.json().catch(() => null);
  // Un chemin de preuve ne peut provenir que de l’upload réalisé par ce serveur.
  if (body && typeof body === "object" && "podPhotoPath" in body) throw new Error("POD_UNTRUSTED_PATH");
  return { input: body, podPhoto: undefined, podSignature: undefined };
}

function normalizedNote(value: string | null | undefined) {
  return value?.trim() || null;
}

function isMatchingPodReplay(
  existing: {
    status: string;
    podOutcome: string | null;
    podPhotoPath: string | null;
    podFailureCode: string | null;
    podNote: string | null;
    podSignaturePath?: string | null;
    podRecipientName?: string | null;
    podSignatureRefusedReason?: string | null;
  },
  input: {
    status: string;
    podFailureCode?: string;
    podNote?: string;
    podRecipientName?: string;
    podSignatureRefusedReason?: string;
  },
  hasPhoto: boolean,
  hasSignature = false
) {
  if (existing.status !== input.status) return false;
  if (input.status === "DELIVERED") {
    return hasPhoto && existing.podOutcome === "SUCCESS" && Boolean(existing.podPhotoPath) &&
      normalizedNote(existing.podNote) === normalizedNote(input.podNote) &&
      Boolean(existing.podSignaturePath) === hasSignature &&
      normalizedNote(existing.podRecipientName) === normalizedNote(input.podRecipientName) &&
      normalizedNote(existing.podSignatureRefusedReason) === normalizedNote(input.podSignatureRefusedReason);
  }
  if (input.status === "FAILED") {
    return existing.podOutcome === "FAILED" && existing.podFailureCode === input.podFailureCode &&
      Boolean(existing.podPhotoPath) === hasPhoto && normalizedNote(existing.podNote) === normalizedNote(input.podNote);
  }
  return false;
}

async function removeUnattachedSignature(path: string | undefined, companyId: string, deliveryId: string) {
  if (!path) return;
  try {
    await deletePodSignature(path, companyId, deliveryId);
  } catch (error) {
    console.error("[pod] nettoyage de signature impossible", path, error instanceof Error ? error.message : error);
  }
}

async function removeUnattachedPhoto(path: string | undefined, companyId: string, deliveryId: string) {
  if (!path) return;
  try {
    await deletePodPhoto(path, companyId, deliveryId);
  } catch (error) {
    console.error("[pod] nettoyage immédiat impossible", path, error instanceof Error ? error.message : error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireDriverRole();
  if ("error" in auth) return auth.error;

  const companyId = auth.context.user.companyId;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 403 });
  const { id } = await params;
  const existing = await prisma.delivery.findFirst({
    where: { id, driverId: auth.context.user.id, companyId },
    select: {
      companyId: true,
      status: true,
      podOutcome: true,
      podPhotoPath: true,
      podFailureCode: true,
      podNote: true,
      podSignaturePath: true,
      podRecipientName: true,
      podSignatureRefusedReason: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
  }

  let raw: Awaited<ReturnType<typeof parseDriverStatusPayload>>;
  try {
    raw = await parseDriverStatusPayload(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPLOAD";
    if (message === "POD_SIGNATURE_TOO_LARGE") {
      return NextResponse.json({ error: "Signature trop volumineuse." }, { status: 413 });
    }
    if (message === "POD_SIGNATURE_INVALID") {
      return NextResponse.json({ error: "Signature invalide. Signez de nouveau à l'écran." }, { status: 400 });
    }
    if (message === "POD_PHOTO_TOO_LARGE") {
      return NextResponse.json({ error: "Photo trop volumineuse. Limite : 5 Mo." }, { status: 413 });
    }
    if (message === "POD_UNTRUSTED_PATH" || message === "POD_INVALID_PHOTO") {
      return NextResponse.json({ error: "Photo invalide. Envoyez une image JPEG ou PNG de 5 Mo maximum." }, { status: 400 });
    }
    if (message.startsWith("POD_")) {
      return NextResponse.json({ error: "Impossible d'enregistrer la photo." }, { status: 502 });
    }
    throw error;
  }

  const parsed = updateDriverDeliveryStatusSchema.safeParse(raw.input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides" },
      { status: 400 }
    );
  }

  const terminal = parsed.data.status === "DELIVERED" || parsed.data.status === "FAILED";
  const expectedOutcome = parsed.data.status === "FAILED" ? "FAILED" : "SUCCESS";
  if (
    !terminal &&
    (raw.podPhoto || raw.podSignature || parsed.data.podOutcome || parsed.data.podFailureCode || parsed.data.podNote ||
      parsed.data.podRecipientName || parsed.data.podSignatureRefusedReason)
  ) {
    return NextResponse.json(
      { error: "Une preuve de livraison ne peut être jointe qu'à la clôture de la mission." },
      { status: 400 }
    );
  }
  if (terminal && parsed.data.podOutcome && parsed.data.podOutcome !== expectedOutcome) {
    return NextResponse.json({ error: "La preuve ne correspond pas au résultat de la mission." }, { status: 400 });
  }
  if (parsed.data.status === "DELIVERED" && !raw.podPhoto) {
    return NextResponse.json({ error: "Une photo de preuve est obligatoire pour clôturer." }, { status: 400 });
  }
  if (parsed.data.status === "FAILED" && !parsed.data.podFailureCode) {
    return NextResponse.json({ error: "Indiquez le motif d'échec." }, { status: 400 });
  }

  // Une réponse réseau peut être perdue après la transaction. Le rejeu du même
  // palier est alors un succès de lecture et ne crée ni événement ni notification.
  if (!terminal && existing.status === parsed.data.status) {
    const replay = await getDriverMissionById(auth.context.user.id, companyId, id);
    if (!replay) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    const { podPhotoPath, ...safeReplayWithSignature } = replay;
    const safeReplay = withoutSignaturePath(safeReplayWithSignature);
    return NextResponse.json({
      data: { ...safeReplay, podPhotoUrl: driverProofUrl(podPhotoPath, replay.id) },
      success: true,
      replay: true,
    });
  }

  if (existing.status === "DELIVERED" || existing.status === "FAILED") {
    if (!isMatchingPodReplay(existing, parsed.data, Boolean(raw.podPhoto), Boolean(raw.podSignature))) {
      return NextResponse.json(
        { error: "Cette mission est déjà clôturée avec une autre preuve.", code: "POD_REPLAY_CONFLICT" },
        { status: 409 }
      );
    }
    const replay = await getDriverMissionById(auth.context.user.id, companyId, id);
    if (!replay) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    const { podPhotoPath, ...safeReplayWithSignature } = replay;
    const safeReplay = withoutSignaturePath(safeReplayWithSignature);
    return NextResponse.json({
      data: { ...safeReplay, podPhotoUrl: driverProofUrl(podPhotoPath, replay.id) },
      success: true,
      replay: true,
    });
  }

  // Règles évaluées après les rejeux idempotents : un rejeu valide reste accepté même si la règle a changé.
  let evidence = { recipientName: null as string | null, signatureRefusedReason: null as string | null };
  if (terminal) {
    try {
      evidence = assertPodEvidence({
        status: parsed.data.status as "DELIVERED" | "FAILED",
        rules: await getCompanyProofRules(existing.companyId),
        hasSignature: Boolean(raw.podSignature),
        recipientName: parsed.data.podRecipientName,
        signatureRefusedReason: parsed.data.podSignatureRefusedReason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (isPodEvidenceError(message)) {
        return NextResponse.json({ error: POD_EVIDENCE_MESSAGES[message], code: message }, { status: 400 });
      }
      throw error;
    }
  }

  let podPhotoPath: string | undefined;
  let podSignaturePath: string | undefined;
  let photoAttached = false;

  try {
    if (raw.podPhoto) {
      podPhotoPath = await uploadPodPhoto({
        companyId: existing.companyId,
        deliveryId: id,
        ...raw.podPhoto,
      });
    }
    if (raw.podSignature) {
      podSignaturePath = await uploadPodSignature({
        companyId: existing.companyId,
        deliveryId: id,
        ...raw.podSignature,
      });
    }
    const mission = await updateDeliveryStatusByDriver(
      auth.context.user.id,
      id,
      parsed.data.status,
      {
        purchaseItems: parsed.data.purchaseItems,
        confirmOutOfRange: parsed.data.confirmOutOfRange,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        podOutcome: terminal ? expectedOutcome : undefined,
        podFailureCode: parsed.data.podFailureCode,
        podNote: parsed.data.podNote,
        podPhotoPath,
        podSignaturePath,
        podRecipientName: evidence.recipientName,
        podSignatureRefusedReason: evidence.signatureRefusedReason,
      }
    );

    if (!mission) {
      await removeUnattachedPhoto(podPhotoPath, existing.companyId, id);
      await removeUnattachedSignature(podSignaturePath, existing.companyId, id);
      return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
    }
    photoAttached = true;

    try {
      await cleanupPodPhotoOrphans({ companyId: existing.companyId, deliveryId: id, keepPath: podPhotoPath ?? null });
    } catch (error) {
      console.error("[pod] nettoyage différé impossible", id, error instanceof Error ? error.message : error);
    }
    const { podPhotoPath: storedPath, ...safeMissionWithSignature } = mission;
    const safeMission = withoutSignaturePath(safeMissionWithSignature);
    return NextResponse.json({
      data: { ...safeMission, podPhotoUrl: driverProofUrl(storedPath, mission.id) },
      success: true,
      replay: false,
    });
  } catch (error) {
    if (!photoAttached) {
      await removeUnattachedPhoto(podPhotoPath, existing.companyId, id);
      await removeUnattachedSignature(podSignaturePath, existing.companyId, id);
    }
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
    if (
      error instanceof Error &&
      (error.message === "DELIVERY_STATUS_CONFLICT" ||
        error.message === "ORDER_STATUS_CONFLICT")
    ) {
      return NextResponse.json(
        {
          error: "La mission a changé pendant votre action. Actualisez avant de continuer.",
          code: error.message,
        },
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
    // Fichier refusé au ré-encodage : erreur du client (4xx), jamais relancée par la file hors ligne.
    if (error instanceof Error && error.message === "POD_INVALID_PHOTO") {
      return NextResponse.json({ error: "Photo invalide. Reprenez la photo (JPEG ou PNG, 5 Mo maximum)." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "POD_SIGNATURE_INVALID") {
      return NextResponse.json({ error: "Signature invalide. Signez de nouveau à l'écran." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "POD_PHOTO_TOO_LARGE") {
      return NextResponse.json({ error: "Photo trop volumineuse. Limite : 5 Mo." }, { status: 413 });
    }
    if (error instanceof Error && error.message === "POD_SIGNATURE_TOO_LARGE") {
      return NextResponse.json({ error: "Signature trop volumineuse." }, { status: 413 });
    }
    if (error instanceof Error && error.message.startsWith("POD_")) {
      return NextResponse.json({ error: "Impossible d'enregistrer la photo." }, { status: 502 });
    }
    throw error;
  }
}
