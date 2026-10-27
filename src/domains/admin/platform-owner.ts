import { normalizeEmail } from "@/lib/auth/normalize-email";

export class OwnerProvisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerProvisionError";
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function planOwnerAccount(input: {
  email: string;
  password: string;
  existingSuperAdminCount: number;
}): {
  email: string;
  password: string;
  companyId: null;
  status: "ACTIVE";
  roleSlug: "super-admin";
} {
  const email = normalizeEmail(input.email);
  if (!EMAIL.test(email)) throw new OwnerProvisionError("E-mail invalide.");
  if (input.password.length < 12) throw new OwnerProvisionError("Mot de passe trop court.");
  if (input.existingSuperAdminCount > 0) {
    throw new OwnerProvisionError("Un compte propriétaire existe déjà.");
  }
  return {
    email,
    password: input.password,
    companyId: null,
    status: "ACTIVE",
    roleSlug: "super-admin",
  };
}
