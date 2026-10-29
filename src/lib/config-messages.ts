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
  SIGNUP_EMAIL_UNAVAILABLE: "La vérification par e-mail est indisponible sur ce serveur : Réessayez plus tard ou contactez-nous.",
  INTAKE_DISABLED: "La commande depuis un message n'est pas activée pour votre entreprise. Activez-la dans la page « Commande par message » (case d'activation en haut de page).",
  INTAKE_NOT_CONFIGURED: `Le service d'analyse des messages n'est pas configuré sur ce serveur : rien n'est analysé. Saisissez la commande à la main. ${PLATFORM_ADMIN_HINT}`,
  DISPATCH_FEATURE_NOT_IN_PLAN: "Le dispatch automatique n'est pas inclus dans votre offre : le réglage n'a pas été enregistré. Choisissez une offre qui l'inclut dans Réglages › Abonnement, ou laissez-le désactivé.",
} as const;

export type ConfigMessageKey = keyof typeof CONFIG_MESSAGES;

/** Message par champ pour un refus de validation (règles dispatch, preuve de livraison…) : champ + cause. */
export function firstFieldMessage(
  flat: { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] },
  labels: Record<string, string>,
  fallback: string
): string {
  for (const [key, messages] of Object.entries(flat.fieldErrors)) {
    if (messages?.length) return `${labels[key] ?? key} : ${messages[0]}`;
  }
  return flat.formErrors[0] ?? fallback;
}

/** Cause d'un échec de paiement : configuration absente, fournisseur injoignable, sinon message d'origine. */
export function billingFailureMessage(error: unknown, fallback: string): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "BILLING_SANDBOX_REQUIRED" || code === "BILLING_WEBHOOK_SECRET_REQUIRED") return CONFIG_MESSAGES.PAYMENT_NOT_CONFIGURED;
  if (code === "BILLING_PROVIDER_UNAVAILABLE") return CONFIG_MESSAGES.PAYMENT_PROVIDER_UNAVAILABLE;
  return fallback;
}
