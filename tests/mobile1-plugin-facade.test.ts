// MOBILE-1 — un module natif Capacitor renvoyé par une fonction async faisait échouer la promesse
// (« "Geolocation.then()" is not implemented on android », recette Android du 14 novembre 2026).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pluginFacade } from "../src/lib/native/plugin-facade";

/** Imite un module Capacitor : toute propriété inconnue, `then` compris, devient un appel natif refusé. */
function capacitorLike(methods: Record<string, (...args: unknown[]) => unknown>) {
  return new Proxy(methods, {
    get(target, name) {
      if (typeof name === "string" && name in target) return target[name];
      if (name === "then") throw new Error(`"Geolocation.${String(name)}()" is not implemented on android`);
      return undefined;
    },
  });
}

test("MOBILE-1 : renvoyer le module lui-même depuis une fonction async échoue (constat)", async () => {
  const plugin = capacitorLike({ checkPermissions: async () => ({ location: "granted" }) });
  await assert.rejects(async () => (async () => plugin)(), /is not implemented on android/);
});

test("MOBILE-1 : la façade se renvoie sans erreur et transmet les appels au module", async () => {
  const calls: unknown[] = [];
  const plugin = capacitorLike({
    checkPermissions: async () => ({ location: "granted" }),
    watchPosition: async (...args: unknown[]) => { calls.push(args); return "watch-1"; },
    clearWatch: async (...args: unknown[]) => { calls.push(args); },
  }) as unknown as { checkPermissions(): Promise<{ location: string }>; watchPosition(options: object, callback: () => void): Promise<string>; clearWatch(options: { id: string }): Promise<void> };
  const facade = await (async () => pluginFacade(plugin, ["checkPermissions", "watchPosition", "clearWatch"]))();
  assert.deepEqual(await facade.checkPermissions(), { location: "granted" });
  assert.equal(await facade.watchPosition({ enableHighAccuracy: true }, () => undefined), "watch-1");
  await facade.clearWatch({ id: "watch-1" });
  assert.equal(calls.length, 2);
  assert.equal("then" in facade, false);
});

test("MOBILE-1 : position et notifications natives passent par la façade", () => {
  for (const file of ["src/lib/native/geolocation.ts", "src/lib/native/push.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /return pluginFacade\(/, `${file} : le module doit être renvoyé via pluginFacade`);
    assert.doesNotMatch(source, /return (Geolocation|PushNotifications) as unknown as/, `${file} : module renvoyé tel quel`);
  }
});
