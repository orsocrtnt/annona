const SCHEMA_PATTERN = /^ops03a_rehearsal_[a-f0-9]{12}_(source|restore)$/;
const BUCKET_PATTERN = /^ops03a-rehearsal-[a-f0-9]{12}-(source|restore)$/;

export function assertOps03aSchema(value: string) {
  if (!SCHEMA_PATTERN.test(value)) throw new Error("OPS03A_REHEARSAL_SCHEMA_REFUSED");
  return value;
}

export function quoteOps03aSchema(value: string) {
  return `"${assertOps03aSchema(value)}"`;
}

export function assertOps03aBucket(value: string) {
  if (!BUCKET_PATTERN.test(value)) throw new Error("OPS03A_REHEARSAL_BUCKET_REFUSED");
  return value;
}

export function databaseUrlForOps03aSchema(value: string, schema: string) {
  assertOps03aSchema(schema);
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("OPS03A_REHEARSAL_DATABASE_URL_REFUSED");
  }
  url.searchParams.set("schema", schema);
  return url.toString();
}
