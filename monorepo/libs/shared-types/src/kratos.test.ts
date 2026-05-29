import { describe, expect, it } from "vitest";
import { getCsrfToken, isKratosUser, toUserClaims, type KratosFlow, type KratosUser } from "./kratos";

const validIdentity: KratosUser = {
  id: "kratos-id-1",
  traits: { name: "Ada", email: "ada@example.com", picture: "p.png" },
};

describe("isKratosUser", () => {
  it("accepts a valid identity", () => {
    expect(isKratosUser(validIdentity)).toBe(true);
  });

  it("accepts an identity with extra fields and minimal traits", () => {
    expect(isKratosUser({ id: "x", traits: {}, schema_id: "default" })).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isKratosUser(null)).toBe(false);
    expect(isKratosUser({})).toBe(false);
    expect(isKratosUser({ id: 1, traits: {} })).toBe(false);
    expect(isKratosUser({ id: "x" })).toBe(false);
    expect(isKratosUser({ id: "x", traits: "nope" })).toBe(false);
    expect(isKratosUser([])).toBe(false);
  });
});

describe("toUserClaims", () => {
  it("projects traits into token claims", () => {
    expect(toUserClaims(validIdentity)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      picture: "p.png",
    });
  });

  it("returns undefined claims when traits are absent", () => {
    expect(toUserClaims({ id: "x", traits: {} })).toEqual({
      name: undefined,
      email: undefined,
      picture: undefined,
    });
  });
});

describe("getCsrfToken", () => {
  const flow: KratosFlow = {
    id: "flow-1",
    ui: {
      action: "https://kratos/self-service/login?flow=flow-1",
      method: "POST",
      nodes: [
        { type: "input", group: "default", attributes: { name: "csrf_token", value: "tok-123", type: "hidden" } },
        { type: "input", group: "oidc", attributes: { name: "provider", value: "google", type: "submit" } },
      ],
    },
  };

  it("reads the csrf_token value from the flow UI nodes", () => {
    expect(getCsrfToken(flow)).toBe("tok-123");
  });

  it("returns null when there is no csrf_token node", () => {
    expect(getCsrfToken({ ui: { action: "", method: "POST", nodes: [] } })).toBeNull();
    expect(getCsrfToken(null)).toBeNull();
    expect(getCsrfToken(undefined)).toBeNull();
  });
});
