/** Adresse IP du client derrière le proxy (dernier saut de x-forwarded-for), pour limiter les débits. */
export function requestSourceFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((entry) => entry.trim()).filter(Boolean).at(-1);
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
