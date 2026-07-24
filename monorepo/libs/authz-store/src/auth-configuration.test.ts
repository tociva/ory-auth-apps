import { describe, expect, it } from "vitest";
import type { Db } from "./db";
import {
  clientSnapshotOf,
  resolveAuthConfiguration,
} from "./auth-config-repository";
import {
  claimAuthTransactionCompletion,
  expireAuthTransactions,
  releaseAuthTransactionForStepUp,
} from "./auth-transaction-repository";

const brand = {
  key: "daybook",
  displayName: "Daybook",
  legalName: "Tociva",
  productName: "Daybook",
  primaryColor: "#2563eb",
  secondaryColor: "#1d4ed8",
  surfaceColor: "#ffffff",
  textColor: "#1f2937",
  mutedTextColor: "#6b7280",
  errorColor: "#b91c1c",
  borderRadius: "16px",
  fontFamily: "system" as const,
  loginHeading: "Sign in",
  loginDescription: "Continue",
  registrationHeading: "Register",
  recoveryHeading: "Recover",
  consentHeading: "Review",
  defaultLocale: "en",
};

const policy = {
  name: "daybook-public",
  passwordEnabled: false,
  passkeyEnabled: false,
  allowedOidcProviders: ["google"],
  totpEnabled: false,
  minimumAal: "aal1" as const,
  registrationMode: "enabled" as const,
  accessMode: "open" as const,
  allowedEmailDomains: [],
  allowedEmails: [],
  requireVerifiedEmail: true,
  forceReauthentication: false,
  sessionMaximumAgeSeconds: 3600,
};

function resolvedRow(clientId = "daybook-web") {
  return {
    hydra_client_id: clientId,
    config_status: "active",
    is_first_party: true,
    consent_mode: "skip-for-first-party",
    mapping_version: 3,
    brand_id: "00000000-0000-4000-8000-000000000001",
    brand_status: "active",
    brand_version: 2,
    brand_definition: brand,
    login_policy_id: "00000000-0000-4000-8000-000000000002",
    policy_status: "active",
    login_policy_version: 4,
    policy_definition: policy,
  };
}

describe("authentication configuration repository", () => {
  it("resolves and snapshots the trusted mapped client configuration", async () => {
    const db = {
      query: async () => ({ rows: [resolvedRow()] }),
    } as unknown as Db;

    const resolved = await resolveAuthConfiguration(db, "daybook-web");

    expect(resolved.usedFallback).toBe(false);
    expect(resolved.brand.key).toBe("daybook");
    expect(resolved.policy.allowedOidcProviders).toEqual(["google"]);
    expect(clientSnapshotOf(resolved)).toEqual(resolved.client);
  });

  it("uses the neutral registry fallback when no mapping exists", async () => {
    let call = 0;
    const db = {
      query: async () => {
        call += 1;
        return { rows: call === 1 ? [] : [resolvedRow("unknown-client")] };
      },
    } as unknown as Db;

    const resolved = await resolveAuthConfiguration(db, "unknown-client");

    expect(resolved.usedFallback).toBe(true);
    expect(resolved.client.hydraClientId).toBe("unknown-client");
  });
});

describe("authentication transaction lifecycle repository", () => {
  it("claims completion only through the guarded one-time SQL transition", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return { rows: [{ id: "transaction-1", status: "completing" }] };
      },
    } as unknown as Db;

    const claimed = await claimAuthTransactionCompletion(db, "opaque-token-hash");

    expect(claimed?.status).toBe("completing");
    expect(calls[0].sql).toContain("expires_at > now()");
    expect(calls[0].sql).toContain("status IN ('created', 'awaiting-authentication', 'authenticated')");
    expect(calls[0].values).toEqual(["opaque-token-hash"]);
  });

  it("expires both login and consent transactions", async () => {
    const sql: string[] = [];
    const db = {
      query: async (query: string) => {
        sql.push(query);
        return { rows: [], rowCount: 2 };
      },
    } as unknown as Db;

    expect(await expireAuthTransactions(db)).toBe(4);
    expect(sql).toHaveLength(2);
    expect(sql.every((query) => query.includes("status = 'expired'"))).toBe(true);
  });

  it("releases a completing transaction for AAL2 step-up reclaim", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return {
          rows: [{ id: "transaction-1", status: "awaiting-authentication", subject: "identity-1" }],
        };
      },
    } as unknown as Db;

    const released = await releaseAuthTransactionForStepUp(db, {
      id: "transaction-1",
      subject: "identity-1",
    });

    expect(released?.status).toBe("awaiting-authentication");
    expect(calls[0].sql).toContain("status = 'awaiting-authentication'");
    expect(calls[0].sql).toContain("kratos_flow_id = NULL");
    expect(calls[0].sql).toContain("status = 'completing'");
    expect(calls[0].values).toEqual(["transaction-1", "identity-1"]);
  });
});
