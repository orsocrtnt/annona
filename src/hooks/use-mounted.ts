"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Faux au rendu serveur et pendant l'hydratation, vrai ensuite dans le navigateur.
 *
 * Les pages du back-office sont précalculées au build (layout client) : un texte qui dépend du jour (« aujourd'hui »,
 * « demain ») y serait figé à la date du déploiement et ne correspondrait plus, le lendemain, à celui du navigateur
 * (erreur React n° 418, page entière recalculée). Ces textes s'affichent donc seulement une fois la page montée.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
