import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { exportCompanyArchive } from "../src/domains/data-lifecycle/company-archive.service";
import type { CompanyExportSummary, CompanyExportVisitor } from "../src/domains/data-lifecycle/company-export.service";

interface CompanyArchiveSnapshot {
  schema: string; version: number;
  externalAssets: { proofObjects: { stopId: string; orderId: string; objectKey: string }[] };
  data: { company: { id: string }; rounds: { id: string; companyId: string; stops: {
    id: string; companyId: string; roundId: string; orderId: string; incidentPhotoPath: string | null;
  }[] }[] };
}
const exportedAt = "2026-10-27T12:00:00.000Z";
// Replays a fixture through the streaming export contract, one order per page.
function replay(s: CompanyArchiveSnapshot) {
  return async (_companyId: string, visitor: CompanyExportVisitor) => {
    await visitor.start({ schema: s.schema, version: s.version, exportedAt } as never, s.data.company as never);
    await visitor.page("users", []);
    if (!s.data.rounds.length) await visitor.page("rounds", []);
    for (const round of s.data.rounds) await visitor.page("rounds", [round] as never);
    return { schema: s.schema, version: s.version, exportedAt, counts: { rounds: s.data.rounds.length },
      externalAssets: s.externalAssets } as unknown as CompanyExportSummary;
  };
}

function snapshot(): CompanyArchiveSnapshot {
  return {
    schema: "annona-company-export", version: 2,
    data: { company: { id: "companyA" }, rounds: [{ id: "roundA", companyId: "companyA", stops: [
      { id: "stopA", companyId: "companyA", roundId: "roundA", orderId: "orderA", incidentPhotoPath: "companyA/stopA-123.png" },
    ] }] }, externalAssets: { proofObjects: [{ stopId: "stopA", orderId: "orderA", objectKey: "companyA/stopA-123.png" }] },
  };
}
// Les droits POSIX (dossier 0700, propriétaire) n'existent pas sous Windows : le service y refuse toujours
// l'export (ARCHIVE_PARENT_NOT_PRIVATE), vérifié par le test « Windows » en fin de fichier.
const POSIX_ONLY = { skip: process.platform === "win32" ? "droits de fichiers POSIX absents sous Windows" : false };
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function context() {
  const parent = await mkdtemp(join(tmpdir(), "data02-unit-"));
  const data = snapshot();
  const reads: string[] = [];
  const dependencies = {
    visitExport: async (companyId: string, visitor: CompanyExportVisitor) => replay(data)(companyId, visitor),
    checkStorage: async () => { reads.push("private-bucket"); },
    download: async (key: string, _signal: AbortSignal): Promise<Response> => { assert.equal(_signal.aborted, false); reads.push(key); return new Response("binary-proof"); },
  };
  return { parent, data, reads, dependencies, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

test("company archive preserves bytes and SHA256, private permissions and relational JSON", POSIX_ONLY, async () => {
  const c = await context();
  try {
    const result = await exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies });
    assert.equal(result.proofCount, 1);
    assert.equal(result.totalProofBytes, 12);
    const raw = await readFile(join(result.path, "manifest.json"));
    assert.equal(digest(raw), result.manifestSha256);
    const manifest = JSON.parse(raw.toString());
    assert.equal(manifest.complete, true);
    assert.equal(manifest.entries.length, 2);
    assert.equal((await stat(result.path)).mode & 0o777, 0o700);
    for (const entry of manifest.entries) {
      const bytes = await readFile(join(result.path, entry.path));
      assert.equal(bytes.length, entry.bytes);
      assert.equal(digest(bytes), entry.sha256);
      assert.equal((await stat(join(result.path, entry.path))).mode & 0o777, 0o600);
    }
    assert.equal(await readFile(join(result.path, "proofs/000001.png"), "utf8"), "binary-proof");
    const companyJson = JSON.parse(await readFile(join(result.path, "company.json"), "utf8"));
    assert.deepEqual(companyJson.data, { ...c.data.data, users: [] });
    assert.deepEqual(companyJson.externalAssets, c.data.externalAssets);
    assert.deepEqual([companyJson.schema, companyJson.version, companyJson.exportedAt], ["annona-company-export", 2, exportedAt]);
    const verify = () => spawnSync(process.execPath, ["scripts/data02/verify-archive.mjs", result.path, result.manifestSha256], { encoding: "utf8" });
    assert.equal(verify().status, 0);
    await writeFile(join(result.path, "proofs/000001.png"), "tampered");
    assert.equal(verify().status, 1);
    assert.notEqual(digest(await readFile(join(result.path, "proofs/000001.png"))), manifest.entries[1].sha256);
    assert.deepEqual(c.reads, ["private-bucket", "companyA/stopA-123.png"]);
    assert.equal((await readdir(c.parent)).length, 1);
  } finally { await c.cleanup(); }
});

test("company archive rejects foreign company/round/stop, invalid paths and altered manifests before Storage", async () => {
  const mutations: ((s: CompanyArchiveSnapshot) => void)[] = [
    (s) => { s.data.company.id = "companyB"; },
    (s) => { s.data.rounds[0]!.companyId = "companyB"; },
    (s) => { s.data.rounds[0]!.stops[0]!.companyId = "companyB"; },
    (s) => { s.data.rounds[0]!.stops[0]!.roundId = "roundB"; },
    ...["companyB/stopA-123.png", "companyA/stopB-123.png", "companyA/../stopA-123.png", "companyA/stopA-123.png?token=x", "https://example.invalid/x", "companyA/stopA-123.png/extra"].map((path) => (s: CompanyArchiveSnapshot) => {
      s.data.rounds[0]!.stops[0]!.incidentPhotoPath = path;
      s.externalAssets.proofObjects[0]!.objectKey = path;
    }),
    (s) => { s.externalAssets.proofObjects = []; },
    (s) => { s.externalAssets.proofObjects[0]!.stopId = "stopB"; },
    (s) => { s.externalAssets.proofObjects[0]!.objectKey = "companyA/stopA-456.png"; },
    (s) => { addSecond(s); s.externalAssets.proofObjects[1] = s.externalAssets.proofObjects[0]!; },
    (s) => { s.data.rounds.push(s.data.rounds[0]!); },
    (s) => { s.data.rounds[0]!.stops.push(s.data.rounds[0]!.stops[0]!); },
  ];
  for (const mutate of mutations) {
    const c = await context();
    try {
      mutate(c.data);
      await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies }), /ARCHIVE_/);
      assert.deepEqual(c.reads, []);
      assert.deepEqual(await readdir(c.parent), []);
    } finally { await c.cleanup(); }
  }
});

function addSecond(s: CompanyArchiveSnapshot) {
  s.data.rounds[0]!.stops.push({ id: "second", companyId: "companyA", roundId: "roundA", orderId: "orderB", incidentPhotoPath: "companyA/second-123.jpg" });
  s.externalAssets.proofObjects.push({ stopId: "second", orderId: "orderB", objectKey: "companyA/second-123.jpg" });
}

test("company archive removes every partial file if a later object is missing or Storage fails", POSIX_ONLY, async () => {
  for (const failure of [404, 500, "network", "stream"] as const) {
    const c = await context();
    addSecond(c.data);
    c.dependencies.download = async (key) => {
      if (key.includes("stopA")) return new Response("first");
      if (failure === "network") throw new Error("https://secret.invalid?token=private");
      if (failure === "stream") return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.error(new Error("broken")); } }));
      return new Response(null, { status: failure });
    };
    try {
      await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies }), failure === 404 ? /ARCHIVE_PROOF_MISSING/ : /^Error: ARCHIVE_DOWNLOAD_FAILED$/);
      assert.deepEqual(await readdir(c.parent), []);
    } finally { await c.cleanup(); }
  }
});

test("company archive enforces streamed/declared per-file sizes, total size, empty/truncated files", POSIX_ONLY, async () => {
  for (const scenario of ["declared", "streamed", "total", "empty", "truncated"] as const) {
    const c = await context();
    if (scenario === "total") addSecond(c.data);
    c.dependencies.download = async () => new Response(scenario === "empty" ? "" : "123456", {
      headers: scenario === "declared" ? { "content-length": "100" } : scenario === "truncated" ? { "content-length": "7" } : {},
    });
    try {
      await assert.rejects(exportCompanyArchive("companyA", c.parent, {
        dependencies: c.dependencies, limits: { maxProofBytes: scenario === "streamed" ? 5 : 10, maxTotalProofBytes: 10 },
      }), /ARCHIVE_PROOF_(SIZE_LIMIT|TRUNCATED)/);
      assert.deepEqual(await readdir(c.parent), []);
    } finally { await c.cleanup(); }
  }
});

test("company archive cancels timeout during body download and leaves no archive", POSIX_ONLY, async () => {
  const c = await context();
  let aborted = false;
  c.dependencies.download = async (_key, signal) => new Response(new ReadableStream({ start(controller) {
    signal.addEventListener("abort", () => { aborted = true; controller.error(new Error("aborted")); }, { once: true });
  } }));
  try {
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies, limits: { downloadTimeoutMs: 15 } }), /ARCHIVE_DOWNLOAD_TIMEOUT/);
    assert.equal(aborted, true);
    assert.deepEqual(await readdir(c.parent), []);
  } finally { await c.cleanup(); }
});

test("company archive rejects non-private folder, unsafe limits, oversized JSON/count and public bucket", POSIX_ONLY, async () => {
  const c = await context();
  try {
    await chmod(c.parent, 0o755);
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies }), /ARCHIVE_PARENT_NOT_PRIVATE/);
    await chmod(c.parent, 0o700);
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies, limits: { maxProofBytes: Infinity } }), /ARCHIVE_INVALID_LIMIT/);
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies, limits: { maxJsonBytes: 1 } }), /ARCHIVE_JSON_TOO_LARGE/);
    addSecond(c.data);
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies, limits: { maxProofs: 1 } }), /ARCHIVE_TOO_MANY_PROOFS/);
    c.dependencies.checkStorage = async () => { throw new Error("POD_STORAGE_PUBLIC"); };
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies }), /POD_STORAGE_PUBLIC/);
    assert.deepEqual(c.reads, []);
    assert.deepEqual(await readdir(c.parent), []);
  } finally { await c.cleanup(); }
});

test("company archive allows empty proof set without Storage and refuses missing company", POSIX_ONLY, async () => {
  const c = await context();
  c.data.data.rounds[0]!.stops[0]!.incidentPhotoPath = null;
  c.data.externalAssets.proofObjects = [];
  try {
    const result = await exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies });
    assert.equal(result.proofCount, 0);
    assert.deepEqual(c.reads, []);
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: { visitExport: async () => null } }), /ARCHIVE_COMPANY_NOT_FOUND/);
  } finally { await c.cleanup(); }
});


test("company archive succeeds exactly at binary limits and preserves an earlier archive on failure", POSIX_ONLY, async () => {
  const c = await context();
  addSecond(c.data);
  try {
    const result = await exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies, limits: { maxProofBytes: 12, maxTotalProofBytes: 24, maxProofs: 2 } });
    assert.equal(result.totalProofBytes, 24);
    const previous = await readFile(join(result.path, "manifest.json"));
    c.dependencies.download = async () => new Response(null, { status: 404 });
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies }), /ARCHIVE_PROOF_MISSING/);
    assert.equal((await readdir(c.parent)).length, 1);
    assert.deepEqual(await readFile(join(result.path, "manifest.json")), previous);
  } finally { await c.cleanup(); }
});

test("company archive refuses to export on Windows, where private POSIX permissions cannot be checked", { skip: process.platform !== "win32" ? "Windows seulement" : false }, async () => {
  const c = await context();
  try {
    await assert.rejects(exportCompanyArchive("companyA", c.parent, { dependencies: c.dependencies }), /ARCHIVE_PARENT_NOT_PRIVATE/);
    assert.deepEqual(c.reads, []);
    assert.deepEqual(await readdir(c.parent), []);
  } finally { await c.cleanup(); }
});
