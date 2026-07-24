import { describe, expect, it } from "vitest";
import { DEFAULT_IDNEST_BRAND, DEFAULT_LOGIN_POLICY, toPublicPolicy } from "./auth-config";

describe("public authentication configuration", () => {
  it("provides a neutral, controlled fallback brand", () => {
    expect(DEFAULT_IDNEST_BRAND.key).toBe("idnest-default");
    expect(DEFAULT_IDNEST_BRAND.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(DEFAULT_IDNEST_BRAND.fontFamily).toBe("system");
  });

  it("does not expose access rules, allowlists, freshness, or reauthentication policy", () => {
    const publicPolicy = toPublicPolicy({
      ...DEFAULT_LOGIN_POLICY,
      allowedEmails: ["administrator@example.com"],
      allowedEmailDomains: ["example.com"],
      accessMode: "grant-required",
      forceReauthentication: true,
      sessionMaximumAgeSeconds: 60,
    });

    expect(publicPolicy.registrationMode).toBe(DEFAULT_LOGIN_POLICY.registrationMode);
    expect(publicPolicy).not.toHaveProperty("allowedEmails");
    expect(publicPolicy).not.toHaveProperty("allowedEmailDomains");
    expect(publicPolicy).not.toHaveProperty("accessMode");
    expect(publicPolicy).not.toHaveProperty("forceReauthentication");
    expect(publicPolicy).not.toHaveProperty("sessionMaximumAgeSeconds");
  });
});
