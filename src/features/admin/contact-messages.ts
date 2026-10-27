"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

/** GROWTH-1, décision C10 : messages du formulaire Contact, lus par le super-administrateur. */
export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
  createdAt: string;
};

export type ContactMessagePage = { items: ContactMessageRow[]; total: number; page: number; pageSize: number };

export async function fetchContactMessages(page: number, pageSize: number): Promise<ContactMessagePage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const res = await fetch(`/api/admin/contact-messages?${params.toString()}`, { cache: "no-store" });
  let json: { error?: string; data?: ContactMessagePage } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as ContactMessagePage;
}

export function useContactMessages(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["admin", "contact-messages", page, pageSize],
    queryFn: () => fetchContactMessages(page, pageSize),
    staleTime: QUERY_STALE_MS,
  });
}
