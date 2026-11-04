import assert from "node:assert/strict";
import test from "node:test";
import { leadingHouseNumber, searchBanAddresses } from "../src/lib/addresses/ban-search";

const feature = (type: string, name: string, label: string) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [2.3, 48.87] },
  properties: { id: `${type}-${name}`, label, name, postcode: "75008", city: "Paris", score: 0.8, type },
});

test("AUDIT-0411 : numéro tapé en tête de saisie", () => {
  assert.equal(leadingHouseNumber("45 avenue des champs elysees"), "45");
  assert.equal(leadingHouseNumber("12 bis rue de rivoli"), "12 bis");
  assert.equal(leadingHouseNumber("3B, rue du Bac"), "3b");
  assert.equal(leadingHouseNumber("avenue des champs"), null);
  assert.equal(leadingHouseNumber("75008 paris"), null);
});

test("AUDIT-0411 : le numéro tapé est gardé quand la base ne renvoie que la rue", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        features: [
          feature("street", "Avenue des Champs Élysées", "Avenue des Champs Élysées 75008 Paris"),
          feature("housenumber", "45 Avenue des Champs Elysées", "45 Avenue des Champs Elysées 02500 Hirson"),
        ],
      }),
      { status: 200 }
    )) as typeof fetch;

  const [street, numbered] = await searchBanAddresses("45 avenue des champs elysees 75008");
  assert.equal(street!.address, "45 Avenue des Champs Élysées");
  assert.equal(street!.label, "45 Avenue des Champs Élysées 75008 Paris");
  assert.equal(street!.numberUnverified, true);
  assert.equal(numbered!.address, "45 Avenue des Champs Elysées");
  assert.equal(numbered!.numberUnverified, undefined);

  const [withoutNumber] = await searchBanAddresses("avenue des champs elysees");
  assert.equal(withoutNumber!.address, "Avenue des Champs Élysées");
  assert.equal(withoutNumber!.numberUnverified, undefined);
});
