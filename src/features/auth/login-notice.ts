/**
 * AUTH-GOOGLE : messages affichés sur la page de connexion au retour de Google ou d'un lien de
 * confirmation (`/auth/callback` renvoie `?google=…` ou `?confirmation=…`).
 */
export type LoginNotice = { variant: "destructive" | "info"; message: string; signupLink?: boolean };

const GOOGLE_NOTICES: Record<string, LoginNotice> = {
  inconnu: {
    variant: "destructive",
    message:
      "Aucun compte Annona pour cette adresse Google. Si vous êtes client ou employé, votre administrateur doit d'abord créer votre compte avec cette adresse.",
    signupLink: true,
  },
  indisponible: { variant: "destructive", message: "Compte ou entreprise indisponible. Contactez votre administrateur." },
  annule: { variant: "info", message: "Connexion avec Google annulée." },
  erreur: { variant: "destructive", message: "La connexion avec Google n'a pas abouti. Réessayez." },
};

const CONFIRMATION_NOTICES: Record<string, LoginNotice> = {
  lien: {
    variant: "info",
    message:
      "Ce lien n'a pas pu ouvrir votre espace. Si vous venez de confirmer votre adresse, connectez-vous avec votre e-mail et votre mot de passe.",
  },
};

export function loginNotice(params: { get(name: string): string | null }): LoginNotice | null {
  const google = params.get("google");
  if (google && Object.hasOwn(GOOGLE_NOTICES, google)) return GOOGLE_NOTICES[google]!;
  const confirmation = params.get("confirmation");
  if (confirmation && Object.hasOwn(CONFIRMATION_NOTICES, confirmation)) return CONFIRMATION_NOTICES[confirmation]!;
  return null;
}
