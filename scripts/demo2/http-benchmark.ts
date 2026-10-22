import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { DEMO_DEFAULT_PASSWORD, DEMO_LOGIN_EMAIL, DEMO_POOL_MIN_READY } from "../../src/lib/demo/constants";

const baseUrl = process.env.DEMO_BASE_URL ?? "";
if (!baseUrl) throw new Error("DEMO_BASE_URL_REQUIRED");
const outputPath = resolve(process.argv[2] ?? "outputs/demo2/http.json");
const sampleCount = Number.parseInt(process.env.DEMO_HTTP_SAMPLES ?? String(DEMO_POOL_MIN_READY), 10);

function p95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

function cookieHeader(response: Response): string {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const values = getSetCookie ? getSetCookie.call(response.headers) : [response.headers.get("set-cookie") ?? ""];
  return values.filter(Boolean).map((value) => value.split(";", 1)[0]).join("; ");
}

async function timed(request: () => Promise<Response>) {
  const started = performance.now();
  const response = await request();
  return { response, ms: performance.now() - started };
}

async function run() {
  assert.ok(Number.isInteger(sampleCount) && sampleCount >= 1 && sampleCount <= DEMO_POOL_MIN_READY);
  const openings: number[] = [];
  const reconnections: number[] = [];
  const logouts: number[] = [];

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const login = await timed(() => fetch(new URL("/api/auth/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: DEMO_LOGIN_EMAIL,
        password: DEMO_DEFAULT_PASSWORD,
        accountType: "company",
        demoRequestKey: randomUUID(),
      }),
    }));
    assert.equal(login.response.status, 200, await login.response.text());
    const cookies = cookieHeader(login.response);
    assert.ok(cookies.includes("tutelliv-demo-session="));
    const dashboard = await timed(() => fetch(new URL("/dashboard", baseUrl), {
      headers: { cookie: cookies },
      redirect: "manual",
    }));
    assert.equal(dashboard.response.status, 200);
    openings.push(login.ms + dashboard.ms);

    for (let reconnect = 0; reconnect < 2; reconnect += 1) {
      const reload = await timed(() => fetch(new URL("/dashboard", baseUrl), {
        headers: { cookie: cookies },
        redirect: "manual",
      }));
      assert.equal(reload.response.status, 200);
      reconnections.push(reload.ms);
    }

    const logout = await timed(() => fetch(new URL("/api/auth/logout", baseUrl), {
      method: "POST",
      headers: { cookie: cookies },
    }));
    assert.equal(logout.response.status, 204);
    logouts.push(logout.ms);
  }

  const result = {
    task: "DEMO-2",
    baseUrl: new URL(baseUrl).origin,
    samples: sampleCount,
    measurementsMs: {
      openingP95: Math.round(p95(openings)),
      openingMax: Math.round(Math.max(...openings)),
      reconnectionP95: Math.round(p95(reconnections)),
      logoutP95: Math.round(p95(logouts)),
    },
  };
  assert.ok(result.measurementsMs.openingP95 <= 5_000, JSON.stringify(result));
  assert.ok(result.measurementsMs.openingMax < 10_000, JSON.stringify(result));
  assert.ok(result.measurementsMs.reconnectionP95 <= 3_000, JSON.stringify(result));
  assert.ok(result.measurementsMs.logoutP95 <= 2_000, JSON.stringify(result));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ ...result, passed: true }, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, passed: true }));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
