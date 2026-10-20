"use client";

/** Le nettoyage serveur est opportuniste : une panne ne doit jamais bloquer la déconnexion. */
export function endServerSession(): void {
  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // La session navigateur est quand même fermée. La rétention serveur reste le filet de sécurité.
  });
}
