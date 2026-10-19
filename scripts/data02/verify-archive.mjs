import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function sha256(path) {
  if (!(await lstat(path)).isFile()) throw new Error("Not a regular file");
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}
async function run() {
  const [directory, expectedManifestHash, ...extra] = process.argv.slice(2);
  if (!directory || !/^[a-f0-9]{64}$/.test(expectedManifestHash ?? "") || extra.length) throw new Error("Invalid arguments");
  if (!(await lstat(directory)).isDirectory() || !(await lstat(join(directory, "proofs"))).isDirectory()) throw new Error("Invalid directory");
  const manifestPath = join(directory, "manifest.json");
  if ((await lstat(manifestPath)).size > 1024 * 1024 || await sha256(manifestPath) !== expectedManifestHash) throw new Error("Manifest mismatch");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "tutelliv-company-archive" || manifest.version !== 1 || manifest.complete !== true || manifest.algorithm !== "sha256" || !Array.isArray(manifest.entries)) throw new Error("Invalid manifest");
  const seen = new Set();
  let totalProofBytes = 0;
  for (const entry of manifest.entries) {
    if (typeof entry.path !== "string" || !/^(company\.json|proofs\/\d{6}\.(png|jpg))$/.test(entry.path) || seen.has(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error("Invalid entry");
    seen.add(entry.path);
    const path = join(directory, entry.path);
    if ((await lstat(path)).size !== entry.bytes || await sha256(path) !== entry.sha256) throw new Error("File mismatch");
    if (entry.path !== "company.json") totalProofBytes += entry.bytes;
  }
  if (!seen.has("company.json") || manifest.proofCount !== seen.size - 1 || manifest.totalProofBytes !== totalProofBytes) throw new Error("Incomplete manifest");
  const roots = (await readdir(directory)).sort();
  if (JSON.stringify(roots) !== JSON.stringify(["company.json", "manifest.json", "proofs"])) throw new Error("Unexpected files");
  const files = await readdir(join(directory, "proofs"));
  if (files.length !== manifest.proofCount || files.some((file) => !seen.has(`proofs/${file}`))) throw new Error("Unexpected proofs");
  console.log(JSON.stringify({ verified: true, proofCount: manifest.proofCount, totalProofBytes }));
}
void run().catch(() => { console.error("ARCHIVE_VERIFICATION_FAILED"); process.exitCode = 1; });
