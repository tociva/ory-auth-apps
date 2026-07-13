import { createHmac, timingSafeEqual } from "node:crypto";

interface ConsentActionPayload {
  action: "accept" | "reject";
  challenge: string;
  subject: string;
  client_id: string;
  exp: number;
}

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function sign(unsigned: string, secret: string): string {
  return createHmac("sha256", secret).update(unsigned).digest("base64url");
}

export function createConsentActionToken(
  payload: Omit<ConsentActionPayload, "exp">,
  secret: string,
  ttlSeconds = 600,
): string {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${body}.${sign(body, secret)}`;
}

export function verifyConsentActionToken(
  token: string,
  secret: string,
  expected: Omit<ConsentActionPayload, "exp">,
): boolean {
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(sign(body, secret));
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ConsentActionPayload;
    return (
      parsed.exp >= Math.floor(Date.now() / 1000) &&
      parsed.action === expected.action &&
      parsed.challenge === expected.challenge &&
      parsed.subject === expected.subject &&
      parsed.client_id === expected.client_id
    );
  } catch {
    return false;
  }
}
