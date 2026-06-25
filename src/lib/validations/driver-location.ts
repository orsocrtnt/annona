import { z } from "zod";

export const updateDriverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

export type UpdateDriverLocationInput = z.infer<typeof updateDriverLocationSchema>;
