import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function themeColors(): Record<string, string> {
  const css = readFileSync("src/app/globals.css", "utf8");
  return Object.fromEntries(
    [...css.matchAll(/--color-([\w-]+):\s*(#[\da-fA-F]{6})/g)].map((match) => [match[1], match[2]])
  );
}

test("UI-2 : les couples de texte essentiels respectent le contraste AA", () => {
  const colors = themeColors();
  const pairs = [
    ["foreground", "background"],
    ["muted-foreground", "background"],
    ["brand", "card"],
    ["background", "brand"],
    ["destructive", "error-subtle"],
    ["success", "success-subtle"],
    ["warning", "warning-subtle"],
  ] as const;

  for (const [foreground, background] of pairs) {
    const ratio = contrast(colors[foreground]!, colors[background]!);
    assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(2)}:1`);
  }
});

test("UI-2 : le lien d'évitement précède l'interface et les espaces exposent la cible", () => {
  const providers = readFileSync("src/components/providers/app-providers.tsx", "utf8");
  assert.ok(providers.indexOf("<SkipLink />") < providers.indexOf("<AccessRefusedNotice />"));

  for (const file of [
    "src/components/layouts/back-office-layout.tsx",
    "src/components/layouts/client-portal-layout.tsx",
    "src/components/layouts/driver-app-layout.tsx",
    "src/app/(auth)/layout.tsx",
    "src/features/legal/legal-document.tsx",
  ]) {
    assert.match(readFileSync(file, "utf8"), /id="main-content"/);
  }
});

test("UI-2 : erreurs de champ reliées au contrôle et annoncées", () => {
  const source = readFileSync("src/components/ui/form-field.tsx", "utf8");
  assert.match(source, /"aria-invalid": error \? true/);
  assert.match(source, /"aria-describedby"/);
  assert.match(source, /role="alert"/);
});
