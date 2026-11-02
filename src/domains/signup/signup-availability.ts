export const SIGNUP_CLOSED_MESSAGE = "L’inscription en ligne n’est pas encore ouverte. Écrivez-nous depuis la page Contact.";

/**
 * Raccourcis de test : paiement fictif et confirmation d'e-mail sans clic. Jamais sur un site hébergé,
 * préversion comprise, car tutelliv.fr tourne en préversion (AUDIT-0111, S2).
 */
export function signupTestShortcutsAllowed(env: NodeJS.ProcessEnv = process.env) {
  return !env.VERCEL_ENV && (env.SIGNUP_PAYMENT_ADAPTER === "fake" || env.NODE_ENV !== "production");
}

/** L'inscription en ligne n'est ouverte que si son dernier écran, le paiement, peut aboutir. */
export function signupOpen(env: NodeJS.ProcessEnv = process.env) {
  return env.SIGNUP_PAYMENT_ADAPTER === "stripe-sandbox" || signupTestShortcutsAllowed(env);
}
