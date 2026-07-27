import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createActionToken,
  createOpaqueToken,
  decryptSensitiveValue,
  encryptSensitiveValue,
  hashOpaqueValue,
  verifyActionToken,
} from "../transaction-crypto";

const originalTransactionSecret = process.env.AUTH_TRANSACTION_SECRET;
const originalConsentSecret = process.env.CONSENT_ACTION_SECRET;

beforeEach(() => {
  process.env.AUTH_TRANSACTION_SECRET = "test-transaction-secret-with-at-least-32-characters";
  process.env.CONSENT_ACTION_SECRET = "test-consent-secret-with-at-least-32-characters";
});

afterEach(() => {
  if (originalTransactionSecret === undefined) delete process.env.AUTH_TRANSACTION_SECRET;
  else process.env.AUTH_TRANSACTION_SECRET = originalTransactionSecret;
  if (originalConsentSecret === undefined) delete process.env.CONSENT_ACTION_SECRET;
  else process.env.CONSENT_ACTION_SECRET = originalConsentSecret;
});

describe("trusted transaction cryptography", () => {
  it("creates opaque random values and deterministic one-way hashes", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).not.toBe(second);
    expect(first).toHaveLength(43);
    expect(hashOpaqueValue(first)).toBe(hashOpaqueValue(first));
    expect(hashOpaqueValue(first)).not.toBe(first);
  });

  it("round-trips encrypted challenges and rejects tampering", () => {
    const encrypted = encryptSensitiveValue("hydra-login-challenge");
    expect(encrypted).not.toContain("hydra-login-challenge");
    expect(decryptSensitiveValue(encrypted)).toBe("hydra-login-challenge");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptSensitiveValue(tampered)).toThrow();
  });

  it("binds consent action tokens to the action and transaction", () => {
    const token = createActionToken("accept", "transaction-hash", 60);
    expect(verifyActionToken(token, "accept", "transaction-hash")).toBe(true);
    expect(verifyActionToken(token, "reject", "transaction-hash")).toBe(false);
    expect(verifyActionToken(token, "accept", "other-transaction")).toBe(false);
    expect(verifyActionToken(`${token}x`, "accept", "transaction-hash")).toBe(false);
  });
});
