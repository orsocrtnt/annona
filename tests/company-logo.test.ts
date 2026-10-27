import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import sharp from "sharp";
import ts from "typescript";
import { isCompanyLogoPath, MAX_LOGO_UPLOAD_BYTES, normalizeCompanyLogo } from "../src/lib/storage/company-logo";

const image = (width: number, height: number, format: "png" | "jpeg" | "webp") =>
  sharp({ create: { width, height, channels: 3, background: "#00d46a" } })[format]().toBuffer();

test("un logo PNG, JPEG ou WebP est ramené à 480×160 au plus, en PNG, sans être agrandi", async () => {
  const wide = await normalizeCompanyLogo(await image(2000, 400, "jpeg"));
  assert.deepEqual([wide.width, wide.height], [480, 96]);
  assert.equal((await sharp(wide.png).metadata()).format, "png");
  const tall = await normalizeCompanyLogo(await image(300, 600, "webp"));
  assert.deepEqual([tall.width, tall.height], [80, 160]);
  const small = await normalizeCompanyLogo(await image(120, 40, "png"));
  assert.deepEqual([small.width, small.height], [120, 40]);
});

test("un fichier qui n'est pas une image acceptée, ou trop lourd, est refusé", async () => {
  await assert.rejects(normalizeCompanyLogo(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), /LOGO_INVALID_IMAGE/);
  await assert.rejects(normalizeCompanyLogo(Buffer.from("pas une image")), /LOGO_INVALID_IMAGE/);
  await assert.rejects(normalizeCompanyLogo(Buffer.alloc(0)), /LOGO_INVALID_IMAGE/);
  await assert.rejects(normalizeCompanyLogo(Buffer.alloc(MAX_LOGO_UPLOAD_BYTES + 1)), /LOGO_TOO_LARGE/);
});

test("seul un chemin de logo de la même entreprise est accepté", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(isCompanyLogoPath(`company_a/logo-${uuid}.png`, "company_a"), true);
  assert.equal(isCompanyLogoPath(`company_b/logo-${uuid}.png`, "company_a"), false);
  assert.equal(isCompanyLogoPath(`company_a/../x/logo-${uuid}.png`, "company_a"), false);
  assert.equal(isCompanyLogoPath("https://exemple.test/logo.png", "company_a"), false);
  assert.equal(isCompanyLogoPath(null, "company_a"), false);
});

type Service = {
  setCompanyLogo(companyId: string, bytes: Buffer): Promise<{ width: number; height: number }>;
  removeCompanyLogo(companyId: string): Promise<void>;
};

function loadService(company: { isDemo: boolean; logoUrl: string | null }, options: { failUpdate?: boolean } = {}) {
  const calls: string[] = [];
  const storage = {
    isCompanyLogoPath: (path: string | null, companyId: string) => Boolean(path?.startsWith(`${companyId}/logo-`)),
    normalizeCompanyLogo: async () => ({ png: Buffer.from("png"), width: 480, height: 96 }),
    uploadCompanyLogo: async (companyId: string) => { calls.push("upload"); return `${companyId}/logo-new.png`; },
    deleteCompanyLogoFile: async (path: string) => { calls.push(`delete:${path}`); },
    downloadCompanyLogo: async () => null,
  };
  const prisma = {
    company: {
      findUnique: async () => ({ id: "company_a", ...company }),
      update: async ({ data }: { data: { logoUrl: string | null } }) => {
        if (options.failUpdate) throw new Error("DB_DOWN");
        calls.push(`update:${data.logoUrl}`);
      },
    },
  };
  const loaded = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve("src/domains/company/company-logo.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(js, {
    Error, Promise, Buffer, console: { warn: () => undefined }, exports: loaded.exports, module: loaded,
    require: (id: string) => ({ "@/services/prisma/client": { prisma }, "@/lib/storage/company-logo": storage } as Record<string, unknown>)[id],
  });
  return { service: loaded.exports as Service, calls };
}

test("en démo, le logo est refusé avant tout envoi de fichier", async () => {
  const { service, calls } = loadService({ isDemo: true, logoUrl: null });
  await assert.rejects(service.setCompanyLogo("company_a", Buffer.from("x")), /LOGO_DEMO_DISABLED/);
  await assert.rejects(service.removeCompanyLogo("company_a"), /LOGO_DEMO_DISABLED/);
  assert.deepEqual(calls, []);
});

test("remplacer un logo enregistre le nouveau puis supprime l'ancien", async () => {
  const { service, calls } = loadService({ isDemo: false, logoUrl: "company_a/logo-old.png" });
  const size = await service.setCompanyLogo("company_a", Buffer.from("x"));
  assert.deepEqual([size.width, size.height], [480, 96]);
  assert.deepEqual(calls, ["upload", "update:company_a/logo-new.png", "delete:company_a/logo-old.png"]);
});

test("si l'enregistrement échoue, le fichier envoyé est supprimé et l'ancien conservé", async () => {
  const { service, calls } = loadService({ isDemo: false, logoUrl: "company_a/logo-old.png" }, { failUpdate: true });
  await assert.rejects(service.setCompanyLogo("company_a", Buffer.from("x")), /DB_DOWN/);
  assert.deepEqual(calls, ["upload", "delete:company_a/logo-new.png"]);
});

test("retirer le logo vide la référence puis supprime le fichier", async () => {
  const { service, calls } = loadService({ isDemo: false, logoUrl: "company_a/logo-old.png" });
  await service.removeCompanyLogo("company_a");
  assert.deepEqual(calls, ["update:null", "delete:company_a/logo-old.png"]);
});
