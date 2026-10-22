const CONFIRMATION = "I_UNDERSTAND_ISOLATED_RESTORE_PROJECT_ONLY";
const PROTECTED_REFS = new Set([
  "wlomrzilflbouzyhzwxm",
  "zwwyalsslyydubtetagj",
]);

export function assertIsolatedProviderRestoreTarget(input: {
  urlValue: string;
  projectRef: string;
  confirmation?: string;
}) {
  if (input.confirmation !== CONFIRMATION) {
    throw new Error("OPS03A_PROVIDER_RESTORE_CONFIRMATION_MISSING");
  }
  if (PROTECTED_REFS.has(input.projectRef)) {
    throw new Error("OPS03A_PROVIDER_RESTORE_PROTECTED_PROJECT_REFUSED");
  }
  if (!/^[a-z]{20}$/.test(input.projectRef)) {
    throw new Error("OPS03A_PROVIDER_RESTORE_PROJECT_REF_INVALID");
  }
  const url = new URL(input.urlValue);
  if (url.protocol !== "https:" || url.hostname !== `${input.projectRef}.supabase.co`) {
    throw new Error("OPS03A_PROVIDER_RESTORE_URL_REF_MISMATCH");
  }
  return input.projectRef;
}
