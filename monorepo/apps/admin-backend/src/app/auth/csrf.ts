import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getAdminCorsOrigins, getAdminCsrfSecret } from "../config";
import { normalizeEmail, type AdminIdentity } from "./authorize";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface CsrfPayload {
  exp: number;
  sub: string;
  email: string;
  nonce: string;
}

interface AuthedRequest extends Request {
  adminIdentity?: AdminIdentity;
  adminEmail?: string;
}

function base64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  return allowedOrigins.some((allowed) => normalizeOrigin(allowed) === normalizedOrigin);
}

export function createCsrfToken(
  identity: AdminIdentity,
  email: string,
  secret: string,
  now = Date.now(),
): string {
  const payload: CsrfPayload = {
    exp: now + TOKEN_TTL_MS,
    sub: identity.id,
    email: normalizeEmail(email),
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${TOKEN_VERSION}.${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function isCsrfPayload(value: unknown): value is CsrfPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.exp === "number" &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    typeof payload.nonce === "string"
  );
}

export function verifyCsrfToken(
  token: string | undefined,
  identity: AdminIdentity,
  email: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false;

  const [, encodedPayload, signature] = parts;
  const expected = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return false;
  }

  if (!isCsrfPayload(payload)) return false;
  if (payload.exp < now) return false;
  if (payload.sub !== identity.id) return false;
  if (normalizeEmail(payload.email) !== normalizeEmail(email)) return false;
  return true;
}

export function requireAdminCsrf() {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    if (!isAllowedOrigin(req.get("origin"), getAdminCorsOrigins())) {
      res.status(403).json({ error: "Invalid origin" });
      return;
    }

    if (
      !req.adminIdentity ||
      !req.adminEmail ||
      !verifyCsrfToken(
        req.get("x-admin-csrf"),
        req.adminIdentity,
        req.adminEmail,
        getAdminCsrfSecret(),
      )
    ) {
      res.status(403).json({ error: "Invalid CSRF token" });
      return;
    }

    next();
  };
}
