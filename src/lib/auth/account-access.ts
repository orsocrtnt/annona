import type { UserWithRole } from "@/types";

/** À évaluer sur les données fraîches du serveur, jamais sur un état client. */
export function isAccountActive(user: UserWithRole): boolean {
  if (user.status !== "ACTIVE") return false;
  if (!user.companyId) return user.role.systemRole === "SUPER_ADMIN";
  return user.company?.id === user.companyId &&
    (user.company.status === "ACTIVE" || user.company.status === "TRIAL");
}

export class AccountUnavailableError extends Error {
  constructor() {
    super("ACCOUNT_UNAVAILABLE");
    this.name = "AccountUnavailableError";
  }
}

export function assertAccountActive(user: UserWithRole): void {
  if (!isAccountActive(user)) throw new AccountUnavailableError();
}
