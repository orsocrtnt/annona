import assert from "node:assert/strict";
import test from "node:test";
import { assertIsolatedProviderRestoreTarget } from "../scripts/ops03a/provider-restore-safety";

const confirmation = "I_UNDERSTAND_ISOLATED_RESTORE_PROJECT_ONLY";

test("accepts an isolated Supabase project whose URL and ref match", () => {
  assert.equal(
    assertIsolatedProviderRestoreTarget({
      urlValue: "https://abcdefghijklmnopqrst.supabase.co",
      projectRef: "abcdefghijklmnopqrst",
      confirmation,
    }),
    "abcdefghijklmnopqrst"
  );
});

test("refuses the historical project and preproduction", () => {
  for (const projectRef of ["wlomrzilflbouzyhzwxm", "zwwyalsslyydubtetagj"]) {
    assert.throws(
      () => assertIsolatedProviderRestoreTarget({
        urlValue: `https://${projectRef}.supabase.co`,
        projectRef,
        confirmation,
      }),
      /PROTECTED_PROJECT_REFUSED/
    );
  }
});

test("refuses missing confirmation and URL/ref mismatches", () => {
  assert.throws(
    () => assertIsolatedProviderRestoreTarget({
      urlValue: "https://abcdefghijklmnopqrst.supabase.co",
      projectRef: "abcdefghijklmnopqrst",
    }),
    /CONFIRMATION_MISSING/
  );
  assert.throws(
    () => assertIsolatedProviderRestoreTarget({
      urlValue: "https://differentprojectrefab.supabase.co",
      projectRef: "abcdefghijklmnopqrst",
      confirmation,
    }),
    /URL_REF_MISMATCH/
  );
});
