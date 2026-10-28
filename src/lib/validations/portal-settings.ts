import { z } from "zod";

/** Réglages de l'espace client pilotés par l'administrateur de l'entreprise. */
export const portalSettingsPatchSchema = z.object({ portalShowDriverPhone: z.boolean() }).strict();

export type PortalSettingsPatch = z.infer<typeof portalSettingsPatchSchema>;
