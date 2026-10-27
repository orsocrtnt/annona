import assert from "node:assert/strict";
import test from "node:test";
import { PERF02_PG_URL, assertLocalPerf02Database } from "../scripts/perf02/local-database";

test("PERF-02 PostgreSQL : seule la base locale jetable est acceptée", () => {
  assert.equal(assertLocalPerf02Database(PERF02_PG_URL).port, "55441");
  assert.equal(assertLocalPerf02Database(`${PERF02_PG_URL}?connection_limit=5`).hostname, "127.0.0.1");
  for (const forbidden of [
    "postgresql://postgres:secret@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    "postgresql://postgres@localhost:55441/perf02",
    "postgresql://postgres@127.0.0.1:5432/perf02",
    "postgresql://postgres@127.0.0.1:55441/postgres",
    "postgresql://postgres@127.0.0.1:55439/saas01b",
  ]) {
    assert.throws(() => assertLocalPerf02Database(forbidden), /PERF02_REMOTE_DATABASE_FORBIDDEN/, forbidden);
  }
  assert.throws(() => assertLocalPerf02Database(undefined), /PERF02_DATABASE_MISSING/);
  assert.throws(() => assertLocalPerf02Database("pas une url"), /PERF02_DATABASE_INVALID/);
});
