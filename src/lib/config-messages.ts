/**
 * Messages des refus de configuration (CONFIG-MSG) : chaque message dit la cause et l'action attendue.
 * Aucun détail interne (nom de variable d'environnement, clé, fournisseur) : un administrateur d'entreprise
 * ne peut pas régler le serveur, il sait seulement à qui s'adresser. Le détail technique reste dans les journaux.
 */

export const PLATFORM_ADMIN_HINT = "Contactez l'administrateur de la plateforme TutelLiv.";

export const CONFIG_MESSAGES = {
  /** Paiement (Stripe) non configuré sur le serveur. */
  PAYMENT_NOT_CONFIGURED: `Le paiement n'est pas configuré sur ce serveur : aucune modification de votre abonnement n'a été faite. ${PLATFORM_ADMIN_HINT}`,
  /** Paiement configuré mais fournisseur injoignable ou en erreur. */
  PAYMENT_PROVIDER_UNAVAILABLE: "Le service de paiement ne répond pas : rien n'a été modifié. Réessayez dans quelques minutes.",
  /** E-mail transactionnel non configuré : invitation. */
  INVITATION_EMAIL_NOT_CONFIGURED: `L'envoi d'e-mails n'est pas configuré sur ce serveur : l'invitation n'a pas été envoyée. ${PLATFORM_ADMIN_HINT} Une fois l'envoi activé, recréez l'invitation.`,
  /** E-mail non configuré : lien de connexion ou de réinitialisation (page publique, message sobre). */
  AUTH_EMAIL_UNAVAILABLE: "L'envoi d'e-mails est indisponible sur ce serveur. Réessayez plus tard ou contactez votre administrateur.",
  /** E-mail non configuré : confirmation d'inscription. */
  SIGNUP_EMAIL_UNAVAILABLE: "La vérification par e-mail est indisponible sur ce serveur : réessayez plus tard ou contactez-nous.",
  INTAKE_DISABLED: "La commande depuis un message n'est pas activée pour votre entreprise. Activez-la dans la page « Commande par message » (case d'activation en haut de page).",
  INTAKE_NOT_CONFIGURED: `Le service d'analyse des messages n'est pas configuré sur ce serveur : rien n'est analysé. Saisissez la commande à la main. ${PLATFORM_ADMIN_HINT}`,
  DISPATCH_FEATURE_NOT_IN_PLAN: "Le dispatch automatique n'est pas inclus dans votre offre : le réglage n'a pas été enregistré. Choisissez une offre qui l'inclut dans Réglages › Abonnement, ou laissez-le désactivé.",
} as const;

export type ConfigMessageKey = keyof typeof CONFIG_MESSAGES;

/** Messages par défaut de Zod (anglais, noms techniques des valeurs) : reconnus pour être remplacés par une phrase française. */
const RAW_ZOD_MESSAGE = /^(Invalid |Unrecognized key|Too (small|big)|Required|Expected |String must|Number must|Array must)|expected .* received|expected one of/i;

/**
 * Message lisible d'un refus de validation : les messages écrits en français dans les schémas passent tels quels ;
 * un message brut de Zod (valeur d'énumération, type attendu, clé inconnue) devient cause + action, sans nom technique.
 */
function readableMessage(message: string, label?: string): string {
  if (!RAW_ZOD_MESSAGE.test(message)) return message;
  if (/^Invalid option|expected one of/i.test(message)) return "valeur non reconnue. Choisissez l'une des options proposées dans la page.";
  if (/expected number/i.test(message)) return "saisissez un nombre.";
  if (/expected boolean/i.test(message)) return "choisissez Activé ou Désactivé.";
  if (/Unrecognized key/i.test(message)) return "réglage inconnu. Actualisez la page puis réessayez.";
  return label ? "valeur invalide. Vérifiez la saisie puis réessayez." : "Valeur invalide : vérifiez la saisie puis réessayez.";
}

/** Message par champ pour un refus de validation (règles dispatch, preuve de livraison…) : champ + cause. */
export function firstFieldMessage(
  flat: { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] },
  labels: Record<string, string>,
  fallback: string
): string {
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (messages?.length) {
      const label = labels[key] ?? key;
      const message = readableMessage(messages[0]!, label);
      return RAW_ZOD_MESSAGE.test(messages[0]!) ? `${label} : ${message}` : `${label} : ${messages[0]}`;
    }
  }
  const form = flat.formErrors[0];
  if (form) {
    const message = readableMessage(form);
    return message === form ? form : `Réglage refusé : ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
  }
  return fallback;
}

/** Cause d'un échec de paiement : configuration absente, fournisseur injoignable, sinon message d'origine. */
export function billingFailureMessage(error: unknown, fallback: string): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "BILLING_SANDBOX_REQUIRED" || code === "BILLING_WEBHOOK_SECRET_REQUIRED") return CONFIG_MESSAGES.PAYMENT_NOT_CONFIGURED;
  if (code === "BILLING_PROVIDER_UNAVAILABLE") return CONFIG_MESSAGES.PAYMENT_PROVIDER_UNAVAILABLE;
  return fallback;
}
