import { z } from "zod";

/** Limite stricte du message collé : au-delà, rien n'est envoyé au modèle. */
export const ORDER_INTAKE_MAX_TEXT_LENGTH = 8000;
export const ORDER_INTAKE_MAX_SENDER_LENGTH = 200;
/** Un message de coursier dépasse rarement quelques livraisons ; au-delà, saisie manuelle. */
export const ORDER_INTAKE_MAX_DELIVERIES = 10;
const MAX_FIELD_LENGTH = 500;

export const orderIntakeRequestSchema = z.object({
  text: z
    .string({ error: "Collez le message à analyser." })
    .trim()
    .min(1, "Collez le message à analyser.")
    .max(ORDER_INTAKE_MAX_TEXT_LENGTH, `Le message dépasse ${ORDER_INTAKE_MAX_TEXT_LENGTH} caractères.`),
  sender: z
    .string({ error: "Expéditeur invalide." })
    .trim()
    .max(ORDER_INTAKE_MAX_SENDER_LENGTH, "Expéditeur trop long.")
    .optional()
    .transform((value) => value || null),
});

export const intakeConfidenceSchema = z.enum(["high", "medium", "low"]);
export type IntakeConfidence = z.infer<typeof intakeConfidenceSchema>;

const sourceSchema = z.string().max(MAX_FIELD_LENGTH).nullable();

/** Chaque valeur porte sa confiance et l'extrait exact du message qui la justifie. */
const textFieldSchema = z
  .object({
    value: z.string().max(MAX_FIELD_LENGTH).nullable(),
    confidence: intakeConfidenceSchema,
    source: sourceSchema,
  })
  .strict();

const quantityFieldSchema = z
  .object({
    value: z.number().int().min(1).max(999).nullable(),
    confidence: intakeConfidenceSchema,
    source: sourceSchema,
  })
  .strict();

const stopSchema = z
  .object({
    address: textFieldSchema,
    city: textFieldSchema,
    postalCode: textFieldSchema,
    contactName: textFieldSchema,
    phone: textFieldSchema,
    instructions: textFieldSchema,
  })
  .strict();

const packagesSchema = z
  .object({ description: textFieldSchema, quantity: quantityFieldSchema })
  .strict();

/** Une livraison porte ses propres colis quand le message les distingue (« 1 palette ici, 3 colis là »). */
const deliverySchema = stopSchema.extend({ packages: packagesSchema }).strict();

/**
 * Le modèle décrit l'échéance sans la calculer : le code la résout dans le fuseau
 * Europe/Paris (order-intake.deadline.ts), ce qui la rend déterministe et testable.
 */
const deadlineSchema = z
  .object({
    mode: z.enum(["before", "at", "after", "between"]).nullable(),
    dayOffset: z.number().int().min(0).max(14).nullable(),
    date: z.string().max(10).nullable(),
    time: z.string().max(5).nullable(),
    endTime: z.string().max(5).nullable(),
    confidence: intakeConfidenceSchema,
    source: sourceSchema,
  })
  .strict();

/**
 * Sortie attendue du modèle. Objet strict : aucune coordonnée, aucun identifiant de client,
 * aucune « action » ne peut s'y glisser, même si le message tiers le demande.
 */
export const orderIntakeExtractionSchema = z
  .object({
    /** MAIL-PONT : tri d'un e-mail reçu. « other » = remerciement, facture, publicité… : pas de brouillon affiché. */
    kind: z
      .object({
        value: z.enum(["order", "other"]),
        reason: z.string().max(200).nullable(),
      })
      .strict(),
    pickup: stopSchema,
    deliveries: z.array(deliverySchema).max(ORDER_INTAKE_MAX_DELIVERIES),
    deadline: deadlineSchema,
    urgency: z
      .object({
        value: z.enum(["urgent", "normal"]).nullable(),
        confidence: intakeConfidenceSchema,
        source: sourceSchema,
      })
      .strict(),
    packages: packagesSchema,
    instructions: textFieldSchema,
    customer: z
      .object({ name: textFieldSchema, email: textFieldSchema, phone: textFieldSchema })
      .strict(),
  })
  .strict();

export type OrderIntakeExtraction = z.infer<typeof orderIntakeExtractionSchema>;
export type IntakeTextField = z.infer<typeof textFieldSchema>;
export type IntakeQuantityField = z.infer<typeof quantityFieldSchema>;
export type IntakeStop = z.infer<typeof stopSchema>;
export type IntakePackages = z.infer<typeof packagesSchema>;
export type IntakeDeliveryExtraction = z.infer<typeof deliverySchema>;
export type IntakeDeadlineExtraction = z.infer<typeof deadlineSchema>;
export type IntakeKind = OrderIntakeExtraction["kind"]["value"];
