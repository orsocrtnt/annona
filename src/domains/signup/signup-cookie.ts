import type { NextResponse } from "next/server";
import { SIGNUP_COOKIE, SIGNUP_TTL_SECONDS } from "@/domains/signup/signup.service";

export function setSignupResumeCookie(response: NextResponse, token: string) {
  response.cookies.set(SIGNUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SIGNUP_TTL_SECONDS,
  });
}

export function clearSignupResumeCookie(response: NextResponse) {
  response.cookies.set(SIGNUP_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}\n