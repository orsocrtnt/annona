import { z } from "zod";

const optionSelection = z.object({
  code: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(500),
});

const signupSelectionFields = {
  planCode: z.enum(["STARTER", "PRO", "BUSINESS"]),
  billingInterval: z.enum(["MONTHLY", "ANNUAL"]),
  optionSelections: z.array(optionSelection).max(20).default([]),
};

export const signupSelectionSchema = z.union([
  z.object({ action: z.literal("create"), ...signupSelectionFields }),
  z.object({ action: z.literal("selection"), ...signupSelectionFields }),
]);

export const signupIdentitySchema = z.object({
  action: z.literal("identity"),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  companyName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  siren: z.string().trim().regex(/^\d{9}$/).optional().or(z.literal("")),
  siret: z.string().trim().regex(/^\d{14}$/).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  billingAddress: z.string().trim().min(5).max(240),
  billingPostalCode: z.string().trim().min(2).max(20),
  billingCity: z.string().trim().min(2).max(120),
  billingCountry: z.string().trim().length(2).default("FR"),
}).refine((value) => !value.siret || !value.siren || value.siret.startsWith(value.siren), {
  message: "Le SIRET doit commencer par le SIREN indiqué.",
  path: ["siret"],
});

export const signupResendEmailSchema = z.object({ action: z.literal("resend-email") });

export const signupActionSchema = z.union([signupSelectionSchema, signupIdentitySchema, signupResendEmailSchema]);

export const fakePaymentSchema = z.object({
  eventKey: z.string().uuid(),
  outcome: z.enum(["confirmed", "declined", "pending"]).default("confirmed"),
});
