import type { Request, Response } from "express";

export const ADMIN_SESSION_COOKIE = "__Host-idnest_admin_session";

export function adminSessionTokenFrom(req: Request): string | undefined {
  return cookieValue(req.get("cookie"), ADMIN_SESSION_COOKIE);
}

export function setAdminSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

export function clearAdminSessionCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    const value = rawValue.join("=");
    try {
      return value ? decodeURIComponent(value) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
