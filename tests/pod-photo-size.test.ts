import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { sanitizePodPhoto } from "../src/lib/storage/pod-image";

/** Image bruitée : incompressible en PNG, donc plus lourde qu'une photo ordinaire. */
async function noisy(format: "png" | "jpeg", size = 700) {
  const raw = randomBytes(size * size * 3);
  const image = sharp(raw, { raw: { width: size, height: size, channels: 3 } });
  return format === "png" ? image.png().toBuffer() : image.jpeg({ quality: 20 }).toBuffer();
}

test("photo ré-encodée plus lourde que la limite : repli en JPEG, taille finale respectée, type mis à jour", async () => {
  const input = await noisy("png");
  assert.ok(input.length > 1_000_000);
  const result = await sanitizePodPhoto(input, "image/png", 300_000);
  assert.ok(result.bytes.length <= 300_000, `${result.bytes.length} octets`);
  assert.equal(result.contentType, "image/jpeg");
  assert.equal((await sharp(result.bytes).metadata()).format, "jpeg");
});

test("JPEG de faible qualité dont le ré-encodage grossit : la limite reste respectée", async () => {
  const input = await noisy("jpeg");
  const reencoded = (await sanitizePodPhoto(input, "image/jpeg", Number.MAX_SAFE_INTEGER)).bytes.length;
  assert.ok(reencoded > input.length, "le ré-encodage à qualité 85 grossit bien ce JPEG de qualité 20");
  const limit = Math.floor(reencoded * 0.9);
  const result = await sanitizePodPhoto(input, "image/jpeg", limit);
  assert.ok(result.bytes.length <= limit);
  assert.equal(result.contentType, "image/jpeg");
});

test("photo qui respecte déjà la limite : format conservé, aucun repli", async () => {
  const input = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#336699" } }).png().toBuffer();
  const result = await sanitizePodPhoto(input, "image/png", 5 * 1024 * 1024);
  assert.equal(result.contentType, "image/png");
  assert.equal((await sharp(result.bytes).metadata()).format, "png");
});

test("impossible de tenir dans la limite : POD_PHOTO_TOO_LARGE ; octets invalides : POD_INVALID_PHOTO", async () => {
  await assert.rejects(sanitizePodPhoto(await noisy("png", 400), "image/png", 200), /POD_PHOTO_TOO_LARGE/);
  await assert.rejects(sanitizePodPhoto(Buffer.from([1, 2, 3]), "image/png", 1000), /POD_INVALID_PHOTO/);
});
