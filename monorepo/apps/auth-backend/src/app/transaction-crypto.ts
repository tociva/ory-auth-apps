import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getAuthTransactionEncryptionSecret, getConsentActionSecret } from "./config";

function encryptionKey(): Buffer {
  return createHash("sha256").update(getAuthTransactionEncryptionSecret()).digest();
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueValue(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function encryptSensitiveValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSensitiveValue(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted transaction value");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

interface ActionPayload {
  action: "accept" | "reject";
  transactionHash: string;
  exp: number;
}

function sign(value: string): string {
  const actionKey = createHash("sha256").update(getConsentActionSecret()).digest();
  return createHmac("sha256", actionKey).update(value).digest("base64url");
}

export function createActionToken(
  action: ActionPayload["action"],
  transactionHash: string,
  ttlSeconds = 600,
): string {
  const payload: ActionPayload = {
    action,
    transactionHash,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyActionToken(
  token: string,
  action: ActionPayload["action"],
  transactionHash: string,
): boolean {
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(body));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ActionPayload;
    return (
      payload.action === action &&
      payload.transactionHash === transactionHash &&
      payload.exp >= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
