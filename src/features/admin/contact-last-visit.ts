"use client";

import { useSyncExternalStore } from "react";

/**
 * ADMIN-ESPACE : dates de la dernière ouverture de « Messages Contact » et de « Liste d'attente »,
 * gardées dans ce navigateur (aucune colonne en base). Servent aux pastilles du menu et au bloc
 * « À traiter » de l'accueil.
 */
export const CONTACT_LAST_VISIT_KEY = "annona:admin:contact-last-visit";
export const WAITLIST_LAST_VISIT_KEY = "annona:admin:waitlist-last-visit";

function createLastVisitStore(key: string) {
  const changeEvent = `${key}-change`;
  function read(): string | null {
    if (typeof window === "undefined") return null;
    try {
      const value = window.localStorage.getItem(key);
      return value && !Number.isNaN(new Date(value).getTime()) ? value : null;
    } catch {
      return null;
    }
  }
  function mark(at: Date = new Date()) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, at.toISOString());
    } catch {
      // Stockage refusé (navigation privée stricte) : les pastilles comptent alors tout.
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(changeEvent, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(changeEvent, onChange);
    };
  }
  return { read, mark, subscribe };
}

const contactStore = createLastVisitStore(CONTACT_LAST_VISIT_KEY);
const waitlistStore = createLastVisitStore(WAITLIST_LAST_VISIT_KEY);

export const readContactLastVisit = contactStore.read;
export const markContactVisited = contactStore.mark;
export const readWaitlistLastVisit = waitlistStore.read;
export const markWaitlistVisited = waitlistStore.mark;

const serverSnapshot = () => undefined;

/** `undefined` tant que le navigateur n'a pas été lu (rendu serveur, hydratation) : attendre avant de lire l'API. */
export function useContactLastVisit(): string | null | undefined {
  return useSyncExternalStore(contactStore.subscribe, contactStore.read, serverSnapshot);
}

export function useWaitlistLastVisit(): string | null | undefined {
  return useSyncExternalStore(waitlistStore.subscribe, waitlistStore.read, serverSnapshot);
}

export type AdminLastVisits = { contact: string | null; waitlist: string | null };

/** Les deux dernières visites, ou `undefined` tant que le navigateur n'a pas été lu. */
export function useAdminLastVisits(): AdminLastVisits | undefined {
  const contact = useContactLastVisit();
  const waitlist = useWaitlistLastVisit();
  if (contact === undefined || waitlist === undefined) return undefined;
  return { contact, waitlist };
}
