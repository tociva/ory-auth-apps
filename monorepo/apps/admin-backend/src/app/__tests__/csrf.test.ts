import { describe, expect, it } from "vitest";
import type { AdminIdentity } from "../auth/authorize";
import {
  createCsrfToken,
  isAllowedOrigin,
  verifyCsrfToken,
} from "../auth/csrf";

const identity: AdminIdentity = {
  id: "u1",
  traits: { email: "admin@example.com" },
};

describe("admin csrf", () => {
  it("allows only configured origins after normalization", () => {
    expect(isAllowedOrigin("https://admin-local.idnest.cloud/page", ["https://admin-local.idnest.cloud"])).toBe(
      true,
    );
    expect(isAllowedOrigin("https://app-local.daybook.cloud", ["https://admin-local.idnest.cloud"])).toBe(
      false,
    );
    expect(isAllowedOrigin(undefined, ["https://admin-local.idnest.cloud"])).toBe(false);
  });

  it("creates and verifies a token bound to the identity and email", () => {
    const token = createCsrfToken(identity, "Admin@Example.COM", "secret", 1000);
    expect(verifyCsrfToken(token, identity, "admin@example.com", "secret", 1000)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = createCsrfToken(identity, "admin@example.com", "secret", 1000);
    expect(verifyCsrfToken(`${token.slice(0, -1)}x`, identity, "admin@example.com", "secret", 1000)).toBe(
      false,
    );
  });

  it("rejects tokens for another identity", () => {
    const token = createCsrfToken(identity, "admin@example.com", "secret", 1000);
    expect(
      verifyCsrfToken(token, { id: "u2", traits: { email: "admin@example.com" } }, "admin@example.com", "secret", 1000),
    ).toBe(false);
  });

  it("rejects expired tokens", () => {
    const token = createCsrfToken(identity, "admin@example.com", "secret", 1000);
    expect(verifyCsrfToken(token, identity, "admin@example.com", "secret", 3 * 60 * 60 * 1000)).toBe(
      false,
    );
  });
});
