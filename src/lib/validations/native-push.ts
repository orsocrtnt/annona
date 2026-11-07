import { z } from "zod";

/**
 * MOBILE-1 — jeton de notification d'une application native (Capacitor).
 * iOS : jeton APNs (hexadécimal) ; Android : jeton FCM (lettres, chiffres, `:`, `_`, `-`).
 * Le jeton n'est jamais une adresse : le serveur l'envoie seulement à Apple ou à Google.
 */
export const NATIVE_PUSH_PLATFORMS = ["ios", "android"] as const;
export type NativePushPlatform = (typeof NATIVE_PUSH_PLATFORMS)[number];

const token = z.string().min(32).max(4096).regex(/^[A-Za-z0-9:_-]+$/, "Jeton de notification invalide");

export const nativePushTokenSchema = z.object({
  platform: z.enum(NATIVE_PUSH_PLATFORMS),
  token,
});

export type NativePushTokenInput = z.infer<typeof nativePushTokenSchema>;
