import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { stripPodPhotoMetadata } from "../src/lib/storage/pod-image";

const gps = { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 24/1", GPSLongitudeRef: "E", GPSLongitude: "2/1 21/1 8/1" } };

async function withExif(format: "jpeg" | "png") {
  const base = sharp({ create: { width: 40, height: 20, channels: 3, background: "#cc3333" } });
  const tagged = base.withExif({ IFD0: { Copyright: "Livreur" }, ...gps }).withMetadata({ orientation: 6 });
  return format === "jpeg" ? tagged.jpeg().toBuffer() : tagged.png().toBuffer();
}

test("JPEG avec EXIF et GPS : métadonnées supprimées, orientation appliquée aux pixels", async () => {
  const input = await withExif("jpeg");
  assert.ok((await sharp(input).metadata()).exif, "fixture avec EXIF");
  const output = await stripPodPhotoMetadata(input, "image/jpeg");
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.exif, undefined);
  assert.ok(!meta.orientation || meta.orientation === 1);
  assert.deepEqual([meta.width, meta.height], [20, 40]);
  assert.ok(!output.includes(Buffer.from("Livreur")));
});

test("PNG avec EXIF : métadonnées supprimées, format conservé", async () => {
  const input = await withExif("png");
  const output = await stripPodPhotoMetadata(input, "image/png");
  const meta = await sharp(output).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.exif, undefined);
  assert.deepEqual([meta.width, meta.height], [20, 40]);
});

test("octets corrompus : photo refusée", async () => {
  await assert.rejects(stripPodPhotoMetadata(Buffer.from([255, 216, 255, 0, 1, 2, 3]), "image/jpeg"), /POD_INVALID_PHOTO/);
});
