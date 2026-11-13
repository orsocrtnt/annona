/**
 * Adresse publique de l'application pour les liens de retour (confirmation d'e-mail, Google) :
 * `NEXT_PUBLIC_APP_URL` si elle est valide, sinon l'origine de la requête. Supabase n'accepte de toute
 * façon que les adresses de sa liste « Redirect URLs ».
 */
export function appOrigin(request: Request): string {
  try {
    const configured = process.env.NEXT_PUBLIC_APP_URL;
    if (configured) return new URL(configured).origin;
  } catch {
    /* adresse mal formée : origine de la requête */
  }
  return new URL(request.url).origin;
}
