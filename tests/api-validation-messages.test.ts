import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { z } from "zod";
import { zodIssueMessage } from "../src/lib/config-messages";

function routes(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) routes(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

test("aucune route API ne renvoie au client le message brut d'un refus Zod", () => {
  const offenders = routes("src/app/api").filter((file) => /issues\[0\]\??\.message/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, [], "utiliser zodIssueMessage ou firstFieldMessage (src/lib/config-messages.ts)");
});

test("zodIssueMessage : jamais « Invalid » ni « expected », message français conservé", () => {
  const schema = z.object({ vatRate: z.number(), mode: z.enum(["A", "B"]), name: z.string().min(2, "Nom trop court") });
  const labels = { vatRate: "Taux de TVA", mode: "Mode" };
  const cases: Array<[unknown, RegExp]> = [
    [{ vatRate: "abc", mode: "A", name: "ok" }, /^Taux de TVA : saisissez un nombre/],
    [{ vatRate: 1, mode: "Z", name: "ok" }, /^Mode : valeur non reconnue/],
    [{ vatRate: 1, mode: "A", name: "x" }, /^Nom trop court$/],
  ];
  for (const [input, expected] of cases) {
    const parsed = schema.safeParse(input);
    assert.ok(!parsed.success);
    const message = zodIssueMessage(parsed.error, "repli", labels);
    assert.match(message, expected);
    assert.doesNotMatch(message, /Invalid|expected|received/);
  }
  assert.match(zodIssueMessage(z.number().safeParse("x").error!, "repli"), /^Saisissez un nombre/);
  assert.equal(zodIssueMessage({ issues: [] }, "repli"), "repli");
});
