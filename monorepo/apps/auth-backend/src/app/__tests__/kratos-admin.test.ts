import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOGIN_POLICY } from "@idnest/shared-types";
import { identityAal2Capability } from "../kratos-admin";
import { mockFetchByUrl } from "./helpers";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("identityAal2Capability", () => {
  it("reports available when totp credentials exist", async () => {
    process.env.KRATOS_ADMIN_URL = "http://localhost:4434";
    mockFetchByUrl([
      {
        match: "/identities/identity-1",
        result: { ok: true, json: { id: "identity-1", credentials: { totp: {}, oidc: {} } } },
      },
    ]);

    await expect(
      identityAal2Capability("identity-1", {
        ...DEFAULT_LOGIN_POLICY,
        totpEnabled: true,
        minimumAal: "aal2",
      }),
    ).resolves.toBe("available");
  });

  it("reports missing when no second-factor credentials exist", async () => {
    process.env.KRATOS_ADMIN_URL = "http://localhost:4434";
    mockFetchByUrl([
      {
        match: "/identities/identity-1",
        result: { ok: true, json: { id: "identity-1", credentials: { oidc: {} } } },
      },
    ]);

    await expect(
      identityAal2Capability("identity-1", {
        ...DEFAULT_LOGIN_POLICY,
        totpEnabled: true,
        minimumAal: "aal2",
      }),
    ).resolves.toBe("missing");
  });

  it("reports unknown when the admin API is unavailable", async () => {
    process.env.KRATOS_ADMIN_URL = "http://localhost:4434";
    mockFetchByUrl([{ match: "/identities/identity-1", result: { ok: false, status: 500 } }]);

    await expect(
      identityAal2Capability("identity-1", {
        ...DEFAULT_LOGIN_POLICY,
        totpEnabled: true,
        minimumAal: "aal2",
      }),
    ).resolves.toBe("unknown");
  });
});
