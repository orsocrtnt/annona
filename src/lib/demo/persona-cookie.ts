import "server-only";
import { cookies } from "next/headers";
import {
  DEMO_PERSONA_COOKIE,
  DEMO_SESSION_COOKIE,
  type DemoPersona,
} from "@/lib/demo/constants";

const VALID_PERSONAS = new Set<DemoPersona>(["admin", "client", "driver"]);

export async function getDemoPersonaCookie(): Promise<DemoPersona> {
  const cookieStore = await cookies();
  const value = cookieStore.get(DEMO_PERSONA_COOKIE)?.value;
  if (value && VALID_PERSONAS.has(value as DemoPersona)) {
    return value as DemoPersona;
  }
  return "admin";
}

export async function setDemoPersonaCookie(persona: DemoPersona): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_PERSONA_COOKIE, persona, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearDemoPersonaCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_PERSONA_COOKIE);
}

export async function getDemoSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;
}

export async function setDemoSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearDemoSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
}
