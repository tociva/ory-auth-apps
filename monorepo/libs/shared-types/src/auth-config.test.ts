import { describe, expect, it } from "vitest";
import {
  DEFAULT_IDNEST_BRAND,
  DEFAULT_LOGIN_POLICY,
  normalizeClientHomeUrl,
  publicAuthRecoveryForClient,
  toPublicPolicy,
} from "./auth-config";

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

  it("normalizes only absolute http client home URLs", () => {
    expect(normalizeClientHomeUrl(" https://app.example.test/dashboard ")).toBe(
      "https://app.example.test/dashboard",
    );
    expect(normalizeClientHomeUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeClientHomeUrl("data:text/html,hi")).toBeUndefined();
    expect(normalizeClientHomeUrl("/relative")).toBeUndefined();
  });

  it("describes client recovery when the home URL is configured", () => {
    expect(
      publicAuthRecoveryForClient(
        {
          hydraClientId: "client-1",
          clientDisplayName: "Example App",
          clientHomeUrl: "https://app.example.test",
        },
        "Fallback",
      ),
    ).toEqual({
      kind: "application_home",
      clientDisplayName: "Example App",
      homeUrl: "https://app.example.test/",
    });
  });

  it("describes missing client URL configuration without inventing a link", () => {
    expect(
      publicAuthRecoveryForClient(
        {
          hydraClientId: "client-1",
          clientDisplayName: "Example App",
        },
        "Fallback",
      ),
    ).toEqual({
      kind: "client_url_not_configured",
      clientDisplayName: "Example App",
    });
  });
});
