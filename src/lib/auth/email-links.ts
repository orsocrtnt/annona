/** Activer seulement après configuration SMTP, modèles, expiration et limites Supabase. */
export function getPasswordLinkRedirect(): string {
  if (process.env.AUTH_EMAIL_LINKS_ENABLED !== "true") throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  let url: URL;
  try { url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? ""); }
  catch { throw new Error("AUTH_EMAIL_NOT_CONFIGURED"); }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  }
  return new URL("/reset-password", url.origin).toString();
}
