export function canSeeDispatchRules(role: string | undefined, permissions: readonly string[]) {
  return (
    (role === "COMPANY_ADMIN" || role === "MINI_ADMIN") &&
    permissions.includes("settings:read") &&
    permissions.includes("settings:update")
  );
}
