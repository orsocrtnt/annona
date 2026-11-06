import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertIsolatedProviderRestoreTarget } from "./provider-restore-safety";

const LEGACY_SOURCE_REF = "wlomrzilflbouzyhzwxm";
const BUCKET = "delivery-pods";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const archive = resolve(process.argv[2] ?? "");
  const output = resolve(process.argv[3] ?? "outputs/ops03a/provider-restore.json");
  if (!process.argv[2]) throw new Error("OPS03A_PROVIDER_STORAGE_ARCHIVE_MISSING");

  const projectRef = required("RESTORE_PROJECT_REF");
  const supabaseUrl = required("RESTORE_SUPABASE_URL");
  const serviceRoleKey = required("RESTORE_SERVICE_ROLE_KEY");
  assertIsolatedProviderRestoreTarget({
    urlValue: supabaseUrl,
    projectRef,
    confirmation: process.env.OPS03A_PROVIDER_RESTORE,
  });

  const startedAt = new Date();
  const tempDirectory = await mkdtemp(join(tmpdir(), "annona-ops03a-provider-storage-"));
  const sourceRoot = join(tempDirectory, LEGACY_SOURCE_REF, BUCKET);
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    execFileSync("unzip", ["-qq", archive, "-d", tempDirectory], { stdio: "pipe" });
    const listed = execFileSync("find", [sourceRoot, "-type", "f", "-print"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .sort();
    if (listed.length === 0) throw new Error("OPS03A_PROVIDER_STORAGE_EMPTY");

    const expected = [] as Array<{ pathHash: string; payloadHash: string; size: number }>;
    for (const file of listed) {
      const objectPath = relative(sourceRoot, file).split(sep).join("/");
      if (!objectPath || objectPath.startsWith("../") || !objectPath.endsWith(".png")) {
        throw new Error("OPS03A_PROVIDER_STORAGE_ARCHIVE_PATH_REFUSED");
      }
      const bytes = await readFile(file);
      const { error: uploadError } = await client.storage.from(BUCKET).upload(objectPath, bytes, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      });
      if (uploadError) throw new Error(`OPS03A_PROVIDER_STORAGE_UPLOAD_FAILED:${uploadError.message}`);

      const { data: downloaded, error: downloadError } = await client.storage
        .from(BUCKET)
        .download(objectPath);
      if (downloadError || !downloaded) {
        throw new Error(`OPS03A_PROVIDER_STORAGE_DOWNLOAD_FAILED:${downloadError?.message ?? "NO_DATA"}`);
      }
      const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
      if (sha256(downloadedBytes) !== sha256(bytes)) {
        throw new Error("OPS03A_PROVIDER_STORAGE_HASH_MISMATCH");
      }

      const { data: signed, error: signedError } = await client.storage
        .from(BUCKET)
        .createSignedUrl(objectPath, 60);
      if (signedError || !signed?.signedUrl) {
        throw new Error(`OPS03A_PROVIDER_STORAGE_SIGNED_URL_FAILED:${signedError?.message ?? "NO_URL"}`);
      }
      const signedResponse = await fetch(signed.signedUrl, { cache: "no-store" });
      if (!signedResponse.ok) {
        throw new Error(`OPS03A_PROVIDER_STORAGE_SIGNED_FETCH_FAILED:${signedResponse.status}`);
      }
      const signedBytes = Buffer.from(await signedResponse.arrayBuffer());
      if (sha256(signedBytes) !== sha256(bytes)) {
        throw new Error("OPS03A_PROVIDER_STORAGE_SIGNED_HASH_MISMATCH");
      }

      expected.push({
        pathHash: sha256(Buffer.from(objectPath)),
        payloadHash: sha256(bytes),
        size: bytes.length,
      });
    }

    const { data: listedObjects, error: listError } = await client.storage
      .from(BUCKET)
      .list("", { limit: 1000 });
    if (listError) throw new Error(`OPS03A_PROVIDER_STORAGE_LIST_FAILED:${listError.message}`);

    const { data: bucketInfo, error: bucketError } = await client.storage.getBucket(BUCKET);
    if (bucketError || !bucketInfo) {
      throw new Error(`OPS03A_PROVIDER_STORAGE_BUCKET_FAILED:${bucketError?.message ?? "NO_BUCKET"}`);
    }
    if (bucketInfo.public) throw new Error("OPS03A_PROVIDER_STORAGE_BUCKET_PUBLIC_REFUSED");

    const { data: authData, error: authError } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw new Error(`OPS03A_PROVIDER_AUTH_LIST_FAILED:${authError.message}`);

    const result = {
      task: "OPS-03A",
      operation: "provider-isolated-storage-restore",
      targetRef: projectRef,
      sourceArchiveSha256: sha256(await readFile(archive)),
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      bucket: {
        private: !bucketInfo.public,
        restoredObjects: expected.length,
        topLevelEntries: listedObjects.length,
        verifiedByDirectDownload: expected.length,
        verifiedBySignedUrl: expected.length,
        objects: expected,
      },
      auth: {
        usersVisibleThroughAdminApi: authData.users.length,
      },
      secretsIncluded: false,
      status: "passed",
    };
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(
      `OPS-03A provider storage restore passed: ${expected.length} objects, ${authData.users.length} auth users.\n`
    );
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
