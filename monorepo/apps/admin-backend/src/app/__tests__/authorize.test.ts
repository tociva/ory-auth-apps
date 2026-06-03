import { afterEach, describe, expect, it, vi } from "vitest";
import { authorize, type AdminIdentity } from "../auth/authorize";
import { mockFetchByUrl } from "./helpers";

const KRATOS = "http://kratos:4433";
const KRATOS_ADMIN = "http://kratos:4434";

function session(identity: Partial<AdminIdentity>, active = true) {
  return {
    active,
    identity: {
      id: "u1",
      traits: { name: "A", email: "admin@example.com" },
      verifiable_addresses: [{ value: "admin@example.com", verified: true, via: "email" }],
      ...identity,
    },
  };
}

function adminIdentity(identity: Partial<AdminIdentity> = {}): AdminIdentity {
  return {
    id: "u1",
    traits: { name: "A", email: "admin@example.com" },
    verifiable_addresses: [{ value: "admin@example.com", verified: true, via: "email" }],
    ...identity,
  };
}

const cfg = (emails: string[] = []) => ({
  kratosPublicUrl: KRATOS,
  kratosAdminUrl: KRATOS_ADMIN,
  bootstrapAdminEmails: emails,
});

afterEach(() => vi.unstubAllGlobals());

describe("authorize (admin authorization middleware)", () => {
  it("rejects requests with no session cookie (401)", async () => {
    mockFetchByUrl([]);
    const res = await authorize(undefined, cfg(["admin@example.com"]));
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects when Kratos has no valid session (401)", async () => {
    mockFetchByUrl([{ match: "/sessions/whoami", result: { ok: false, status: 401 } }]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects an authenticated but non-allowlisted user (403)", async () => {
    mockFetchByUrl([
      { match: "/sessions/whoami", result: { ok: true, json: session({}) } },
      { match: "/identities/u1", result: { ok: true, json: adminIdentity() } },
    ]);
    const res = await authorize("ory_session=x", cfg([])); // empty allowlist, no role
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("allows a user in the bootstrap allowlist", async () => {
    mockFetchByUrl([
      { match: "/sessions/whoami", result: { ok: true, json: session({}) } },
      { match: "/identities/u1", result: { ok: true, json: adminIdentity() } },
    ]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res.ok).toBe(true);
  });

  it("allows a user with metadata_admin.role === 'admin' on the admin identity", async () => {
    mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: { ok: true, json: session({}) },
      },
      {
        match: "/identities/u1",
        result: { ok: true, json: adminIdentity({ metadata_admin: { role: "admin" } }) },
      },
    ]);
    const res = await authorize("ory_session=x", cfg([])); // not in list, but has role
    expect(res.ok).toBe(true);
  });

  it("does not trust metadata_admin from whoami without the admin identity role", async () => {
    mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: { ok: true, json: session({ metadata_admin: { role: "admin" } }) },
      },
      { match: "/identities/u1", result: { ok: true, json: adminIdentity() } },
    ]);
    const res = await authorize("ory_session=x", cfg([]));
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("matches the bootstrap email case-insensitively and trimmed", async () => {
    mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: { ok: true, json: session({}) },
      },
      {
        match: "/identities/u1",
        result: {
          ok: true,
          json: adminIdentity({
            traits: { email: "  Admin@Example.COM " },
            verifiable_addresses: [{ value: "admin@example.com", verified: true }],
          }),
        },
      },
    ]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res.ok).toBe(true);
  });

  it("rejects when the email is not verified (403)", async () => {
    mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: { ok: true, json: session({}) },
      },
      {
        match: "/identities/u1",
        result: {
          ok: true,
          json: adminIdentity({
            verifiable_addresses: [{ value: "admin@example.com", verified: false }],
          }),
        },
      },
    ]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res).toMatchObject({ ok: false, status: 403, error: "Email not verified" });
  });

  it("rejects an inactive session (401)", async () => {
    mockFetchByUrl([
      { match: "/sessions/whoami", result: { ok: true, json: session({}, false) } },
    ]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects when the admin identity lookup fails", async () => {
    mockFetchByUrl([
      { match: "/sessions/whoami", result: { ok: true, json: session({}) } },
      { match: "/identities/u1", result: { ok: false, status: 404 } },
    ]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res).toMatchObject({ ok: false, status: 401, error: "Identity lookup failed" });
  });
});
