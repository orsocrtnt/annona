import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
).split("\0").filter(Boolean);

const forbiddenNames = [
  /(^|\/)\.env(?:\..+)?$/,
  /\.(?:pem|key|p12|pfx)$/i,
];
const allowedNames = new Set([".env.example"]);
const binaryExtensions = new Set([
  ".avif", ".gif", ".ico", ".jpeg", ".jpg", ".pdf", ".png", ".webp", ".woff", ".woff2",
]);
const detectors = [
  {
    name: "private-key",
    pattern: new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?PRIVATE KEY-----"].join("")),
  },
  {
    name: "openai-key",
    pattern: new RegExp(["\\bsk", "-[A-Za-z0-9_-]{20,}\\b"].join("")),
  },
  {
    name: "database-credentials",
    pattern: new RegExp(["postgres(?:ql)?", ":\\/\\/[^:\\s]+:[^@\\s]+@"].join(""), "i"),
  },
];
const explicitFixtureFragments = [
  "127.0.0.1",
  "localhost",
  ".invalid",
  "example.pooler.supabase.com",
  "elsewhere.test",
  "sk-this-is-a-secret-value",
];

const findings = [];
let scanned = 0;
for (const file of files) {
  if (file === "scripts/ci/scan-secrets.mjs") continue;
  if (!allowedNames.has(file) && forbiddenNames.some((pattern) => pattern.test(file))) {
    findings.push({ file, detector: "forbidden-secret-file" });
    continue;
  }
  if (allowedNames.has(file)) continue;
  if (binaryExtensions.has(extname(file).toLowerCase())) continue;
  let size = 0;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > 2 * 1024 * 1024) continue;
  let body = "";
  try {
    body = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  scanned += 1;
  for (const detector of detectors) {
    const matcher = new RegExp(detector.pattern.source, `${detector.pattern.flags.replace("g", "")}g`);
    for (const match of body.matchAll(matcher)) {
      const value = match[0].toLowerCase();
      const index = match.index ?? 0;
      const context = body.slice(Math.max(0, index - 80), index + value.length + 160).toLowerCase();
      if (explicitFixtureFragments.some((fragment) => context.includes(fragment))) continue;
      findings.push({ file, detector: detector.name });
      break;
    }
  }
}

if (findings.length) {
  console.error(JSON.stringify({ passed: false, scanned, findings }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, scanned, findings: 0 }));
