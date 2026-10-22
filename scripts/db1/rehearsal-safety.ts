const SCHEMA_PATTERN = /^db1_rehearsal_[a-f0-9]{12}_(source|restore)$/;

export function isDb1RehearsalSchema(value: string) {
  return SCHEMA_PATTERN.test(value);
}

export function assertDb1RehearsalSchema(value: string) {
  if (!isDb1RehearsalSchema(value)) {
    throw new Error("DB1_REHEARSAL_SCHEMA_REFUSED");
  }
  return value;
}

export function quoteRehearsalSchema(value: string) {
  return `"${assertDb1RehearsalSchema(value)}"`;
}

export function databaseUrlForSchema(value: string, schema: string) {
  assertDb1RehearsalSchema(schema);
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DB1_REHEARSAL_DATABASE_URL_REFUSED");
  }
  url.searchParams.set("schema", schema);
  return url.toString();
}
