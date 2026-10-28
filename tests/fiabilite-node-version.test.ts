import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("la version de Node est fixée de façon cohérente (.nvmrc, engines, CI)", () => {
  const nvmrc = readFileSync(resolve(".nvmrc"), "utf8").trim();
  const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
    engines?: { node?: string };
  };
  const ci = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
  assert.equal(nvmrc, "22.18.0");
  assert.equal(pkg.engines?.node, ">=22.18 <23");
  for (const match of ci.matchAll(/node-version: "([^"]+)"/g)) {
    assert.equal(match[1], nvmrc);
  }
});
