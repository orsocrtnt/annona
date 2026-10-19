import { z } from "zod";
import {
  ORDER_HISTORY_DEFAULT_PAGE_SIZE,
  ORDER_HISTORY_PAGE_SIZES,
} from "@/lib/query/order-history";

const orderStatuses = [
  "QUOTE_REQUESTED",
  "PENDING",
  "ASSIGNED",
  "PURCHASING",
  "IN_DELIVERY",
  "DELIVERED",
  "INVOICED",
  "PAID",
  "CANCELLED",
  "FAILED",
] as const;

const deliveryCategories = ["STANDARD", "COURIER", "SPECIAL_MISSION"] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalTrimmed(max: number) {
  return z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).max(max).optional()
  );
}

const optionalDate = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().refine(isCalendarDate, "Date invalide").optional()
);

export const orderHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number()
    .refine((value) => ORDER_HISTORY_PAGE_SIZES.includes(value as 25 | 50 | 100))
    .transform((value) => value as 25 | 50 | 100)
    .default(ORDER_HISTORY_DEFAULT_PAGE_SIZE),
  search: optionalTrimmed(100),
  status: z.enum(orderStatuses).optional(),
  category: z.enum(deliveryCategories).optional(),
  from: optionalDate,
  to: optionalDate,
  history: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: "custom", path: ["to"], message: "La date de fin précède la date de début" });
  }
});

export function parseOrderHistoryQuery(url: string) {
  const params = new URL(url).searchParams;
  return orderHistoryQuerySchema.safeParse({
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    category: params.get("category") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    history: params.get("history") ?? undefined,
  });
}
