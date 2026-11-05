"use client";

import { useSyncExternalStore } from "react";

/**
 * ADMIN-ESPACE : date de la dernière ouverture de « Messages Contact », gardée dans ce navigateur
 * (aucune colonne en base). Sert aux pastilles du menu et au bloc « À traiter » de l'accueil.
 */
export const CONTACT_LAST_VISIT_KEY = "tutelliv:admin:contact-last-visit";
const CHANGE_EVENT = "tutelliv:admin:contact-last-visit-change";

export function readContactLastVisit(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONTACT_LAST_VISIT_KEY);
    return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
  } catch {
    return null;
  }
}

export function markContactVisited(at: Date = new Date()) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTACT_LAST_VISIT_KEY, at.toISOString());
  } catch {
    // Stockage refusé (navigation privée stricte) : les pastilles comptent alors tous les messages.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** `undefined` tant que le navigateur n'a pas été lu (rendu serveur, hydratation) : attendre avant de lire l'API. */
export function useContactLastVisit(): string | null | undefined {
  return useSyncExternalStore(subscribe, readContactLastVisit, () => undefined);
}
