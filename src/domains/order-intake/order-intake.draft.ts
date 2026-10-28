import { parisToday, resolveDeadline, type ResolvedDeadline } from "./order-intake.deadline";
import type {
  IntakeQuantityField,
  IntakeStop,
  IntakeTextField,
  OrderIntakeExtraction,
} from "./order-intake.schema";

export interface IntakeCustomerMatch {
  customerId: string;
  displayName: string;
  email: string;
  matchedBy: "email" | "phone";
}

export interface OrderIntakeDraft {
  referenceDate: string;
  pickup: IntakeStop;
  deliveries: IntakeStop[];
  deadline: ResolvedDeadline;
  urgency: OrderIntakeExtraction["urgency"];
  packages: { description: IntakeTextField; quantity: IntakeQuantityField };
  instructions: IntakeTextField;
  customerHint: OrderIntakeExtraction["customer"];
  customerMatch: IntakeCustomerMatch | null;
  /** Champs nécessaires à la création et absents du message. */
  missingFields: string[];
  /** Champs présents mais peu sûrs : à relire avant de créer. */
  uncertainFields: string[];
}

function normalizeForSearch(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Un extrait qui n'apparaît pas dans le message est une invention : il est retiré et le champ
 * devient peu sûr. Une valeur sans extrait est elle aussi peu sûre.
 */
function verifyField<T extends { value: unknown; confidence: IntakeTextField["confidence"]; source: string | null }>(
  field: T,
  haystack: string
): T {
  const source = field.source?.trim() ? field.source : null;
  const found = source !== null && haystack.includes(normalizeForSearch(source));
  if (field.value === null) return { ...field, source: found ? source : null };
  if (!found) return { ...field, source: null, confidence: "low" };
  return field;
}

function verifyStop(stop: IntakeStop, haystack: string): IntakeStop {
  return {
    address: verifyField(stop.address, haystack),
    city: verifyField(stop.city, haystack),
    postalCode: verifyField(stop.postalCode, haystack),
    contactName: verifyField(stop.contactName, haystack),
    phone: verifyField(stop.phone, haystack),
    instructions: verifyField(stop.instructions, haystack),
  };
}

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === "string" && value.trim() === "");
const REQUIRED_STOP_FIELDS = ["address", "city", "postalCode"] as const;

function collectStopFlags(prefix: string, stop: IntakeStop, missing: string[], uncertain: string[]) {
  for (const key of REQUIRED_STOP_FIELDS) {
    if (isBlank(stop[key].value)) missing.push(`${prefix}.${key}`);
  }
  for (const [key, field] of Object.entries(stop) as Array<[keyof IntakeStop, IntakeTextField]>) {
    if (!isBlank(field.value) && field.confidence === "low") uncertain.push(`${prefix}.${key}`);
  }
}

export function buildOrderIntakeDraft(
  extraction: OrderIntakeExtraction,
  text: string,
  now: Date
): OrderIntakeDraft {
  const haystack = normalizeForSearch(text);
  const pickup = verifyStop(extraction.pickup, haystack);
  const deliveries = extraction.deliveries.map((stop) => verifyStop(stop, haystack));
  const deadline = resolveDeadline(verifyField({ ...extraction.deadline, value: extraction.deadline.mode }, haystack), now);
  const urgency = verifyField(extraction.urgency, haystack);
  const packages = {
    description: verifyField(extraction.packages.description, haystack),
    quantity: verifyField(extraction.packages.quantity, haystack),
  };
  const instructions = verifyField(extraction.instructions, haystack);
  const customerHint = {
    name: verifyField(extraction.customer.name, haystack),
    email: verifyField(extraction.customer.email, haystack),
    phone: verifyField(extraction.customer.phone, haystack),
  };

  const missing: string[] = [];
  const uncertain: string[] = [];
  collectStopFlags("pickup", pickup, missing, uncertain);
  if (deliveries.length === 0) missing.push("deliveries");
  deliveries.forEach((stop, index) => collectStopFlags(`deliveries.${index}`, stop, missing, uncertain));
  if (!deadline.date) missing.push("deadline");
  else if (deadline.isPast || deadline.confidence === "low") uncertain.push("deadline");
  if (packages.quantity.value === null) missing.push("packages.quantity");
  else if (packages.quantity.confidence === "low") uncertain.push("packages.quantity");
  if (!isBlank(packages.description.value) && packages.description.confidence === "low") uncertain.push("packages.description");

  return {
    referenceDate: parisToday(now).date,
    pickup,
    deliveries,
    deadline,
    urgency,
    packages,
    instructions,
    customerHint,
    customerMatch: null,
    missingFields: missing,
    uncertainFields: uncertain,
  };
}

/** Normalise un numéro français : +33 / 0033 deviennent 0, seuls les chiffres restent. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+33")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("0033")) digits = `0${digits.slice(4)}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

/** L'expéditeur facultatif est un e-mail ou un téléphone ; rien d'autre n'est interprété. */
export function parseSender(value: string | null | undefined): { email: string | null; phone: string | null } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { email: null, phone: null };
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email, phone: null } : { email: null, phone: null };
  }
  return { email: null, phone: normalizePhone(trimmed) };
}
