/**
 * MOBILE-1 — canal `native_push` ajouté aux notifications du client (NOT-01 à NOT-03) par
 * `registerNotificationChannel`, sans toucher aux déclencheurs.
 *
 * - Sans clés APNs ni FCM : « disabled » (rien n'est lu ni envoyé), comme l'e-mail sans Resend.
 * - Aucun appareil natif pour ce compte : « off ».
 * - Au mieux : un échec d'envoi ne relance pas la tâche (la cloche et l'e-mail, idempotents, sont
 *   déjà passés ; une relance ferait sonner deux fois les autres téléphones). Il est journalisé.
 */
import {
  deliverToNativeDevices,
  getNativePushConfig,
  nativePushConfigured,
  type NativePushConfig,
  type NativePushSender,
} from "@/domains/notification/native-push.service";
import { registerNotificationChannel, type NotificationChannel } from "@/domains/notification/notification-channels";
import type { prisma } from "@/services/prisma/client";

export function nativePushChannel(deps: {
  config?: () => NativePushConfig;
  db?: Pick<typeof prisma, "driverPushSubscription">;
  send?: NativePushSender;
} = {}): NotificationChannel {
  return {
    id: "native_push",
    async deliver(message, recipient) {
      const config = (deps.config ?? getNativePushConfig)();
      if (!nativePushConfigured(config)) return "disabled";
      try {
        const result = await deliverToNativeDevices(
          { userId: recipient.userId, companyId: recipient.companyId },
          { title: message.title, body: message.body, url: message.href },
          { config, db: deps.db, send: deps.send }
        );
        if (result.failed > 0) console.warn(`[native_push] ${result.failed} envoi(s) natif(s) en échec`);
        return result.sent > 0 ? "sent" : "off";
      } catch (error) {
        console.warn("[native_push] envoi natif impossible", error instanceof Error ? error.message : error);
        return "off";
      }
    },
  };
}

registerNotificationChannel(nativePushChannel());
