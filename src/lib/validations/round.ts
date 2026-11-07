import { z } from "zod";
import { STOP_INCIDENT_CODES } from "@/domains/round/round-rules";

/** TOUR-1 — saisies des tournées (ADM-06, ADM-07) et de l'application livreur (LIV-03, LIV-05). */
const id = z.string().trim().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const instant = z.string().datetime({ offset: true }).max(40);

export const roundsDayQuerySchema = z.object({ date });
export const createRoundSchema = z.object({ date, slotId: id }).strict();
export const assignDriverSchema = z.object({ driverId: id.nullable() }).strict();
export const reorderStopsSchema = z.object({ stopIds: z.array(id).min(1).max(200) }).strict();
export const moveStopSchema = z.object({ roundId: id, position: z.number().int().min(1).max(500).nullable().optional() }).strict();
export const validateRoundsSchema = z.object({ date }).strict();

export const deliveredSchema = z.object({ at: instant.nullable().optional() }).strict();
export const incidentFieldsSchema = z.object({
  code: z.enum(STOP_INCIDENT_CODES),
  comment: z.string().trim().max(500).optional().default(""),
  at: instant.nullable().optional(),
});

export type IncidentFields = z.infer<typeof incidentFieldsSchema>;
