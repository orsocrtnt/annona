import { createAdminClient } from "@/services/supabase/admin";

const POD_BUCKET = "delivery-pods";
const SIGNED_URL_SECONDS = 60 * 60;

let bucketReady: Promise<void> | null = null;

async function ensurePodBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(`POD_STORAGE: ${error.message}`);
      if (data?.some((bucket) => bucket.name === POD_BUCKET)) return;
      const created = await supabase.storage.createBucket(POD_BUCKET, {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024,
      });
      if (created.error) throw new Error(`POD_STORAGE: ${created.error.message}`);
    })();
  }
  await bucketReady;
}

export async function uploadPodPhoto(params: {
  companyId: string;
  deliveryId: string;
  bytes: Buffer;
  contentType: string;
}) {
  await ensurePodBucket();
  const ext = params.contentType.includes("png") ? "png" : "jpg";
  const path = `${params.companyId}/${params.deliveryId}-${Date.now()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(POD_BUCKET).upload(path, params.bytes, {
    contentType: params.contentType,
    upsert: true,
  });
  if (error) throw new Error(`POD_UPLOAD: ${error.message}`);
  return path;
}

export async function getPodPhotoSignedUrl(path: string | null | undefined) {
  if (!path) return null;
  await ensurePodBucket();
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(POD_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
