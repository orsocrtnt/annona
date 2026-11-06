/**
 * Présence humaine sur la page (6 novembre 2026) : les antivirus des messageries (Microsoft Safe Links,
 * Proofpoint, Altospam…) ouvrent chaque lien des mails dans un vrai navigateur pour l'analyser ; ils ne
 * cliquent pas, ne tapent pas et ne font pas défiler. Un compteur n'est donc envoyé qu'après un geste réel
 * du visiteur : appui, touche, molette ou plusieurs mouvements de souris (événements `isTrusted` seulement).
 */
const MOUSE_MOVES_NEEDED = 3;

export function onHumanPresence(callback: () => void, target: Window = window): () => void {
  let done = false;
  let moves = 0;
  const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

  function fire() {
    if (done) return;
    done = true;
    stop();
    callback();
  }
  function onGesture(event: Event) {
    if (event.isTrusted) fire();
  }
  function onMove(event: Event) {
    if (!event.isTrusted || (event as PointerEvent).pointerType !== "mouse") return;
    moves += 1;
    if (moves >= MOUSE_MOVES_NEEDED) fire();
  }
  function stop() {
    for (const name of events) target.removeEventListener(name, onGesture);
    target.removeEventListener("pointermove", onMove);
  }

  for (const name of events) target.addEventListener(name, onGesture, { passive: true });
  target.addEventListener("pointermove", onMove, { passive: true });
  return stop;
}
