import { describe, expect, it } from "vitest";
import { createConsentActionToken, verifyConsentActionToken } from "../handlers/consent-token";

const payload = {
  action: "accept" as const,
  challenge: "cc_1",
  subject: "kratos-id-1",
  client_id: "app-a",
};

describe("consent action tokens", () => {
  it("verifies a matching short-lived action token", () => {
    const token = createConsentActionToken(payload, "secret");
    expect(verifyConsentActionToken(token, "secret", payload)).toBe(true);
  });

  it("rejects tokens for a different action or client", () => {
    const token = createConsentActionToken(payload, "secret");
    expect(verifyConsentActionToken(token, "secret", { ...payload, action: "reject" })).toBe(false);
    expect(verifyConsentActionToken(token, "secret", { ...payload, client_id: "app-b" })).toBe(false);
  });
});
