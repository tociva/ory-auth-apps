import { afterEach, describe, expect, it, vi } from "vitest";
import { authorize, type AdminIdentity } from "../auth/authorize";
import { mockFetchByUrl } from "./helpers";

const KRATOS = "http://kratos:4433";

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

const cfg = (emails: string[] = []) => ({
  kratosPublicUrl: KRATOS,
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
    ]);
    const res = await authorize("ory_session=x", cfg([])); // empty allowlist, no role
    expect(res).toMatchObject({ ok: false, status: 403 });
  });

  it("allows a user in the bootstrap allowlist", async () => {
    mockFetchByUrl([
      { match: "/sessions/whoami", result: { ok: true, json: session({}) } },
    ]);
    const res = await authorize("ory_session=x", cfg(["admin@example.com"]));
    expect(res.ok).toBe(true);
  });

  it("allows a user with metadata_admin.role === 'admin'", async () => {
    mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: { ok: true, json: session({ metadata_admin: { role: "admin" } }) },
      },
    ]);
    const res = await authorize("ory_session=x", cfg([])); // not in list, but has role
    expect(res.ok).toBe(true);
  });

  it("matches the bootstrap email case-insensitively and trimmed", async () => {
    mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: {
          ok: true,
          json: session({
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
        result: {
          ok: true,
          json: session({
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
});
