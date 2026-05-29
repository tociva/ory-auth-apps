import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listIdentitySessions,
  revokeIdentitySessions,
  revokeSession,
} from "../handlers/sessions";
import { mockFetchByUrl } from "./helpers";

beforeEach(() => {
  process.env.KRATOS_ADMIN_URL = "http://kratos:4434";
});
afterEach(() => vi.unstubAllGlobals());

describe("session management", () => {
  it("lists an identity's sessions", async () => {
    mockFetchByUrl([
      { match: "/identities/u1/sessions", result: { ok: true, json: [{ id: "s1" }] } },
    ]);
    expect(await listIdentitySessions({ id: "u1" })).toMatchObject({ status: 200 });
  });

  it("revokes all sessions for an identity", async () => {
    mockFetchByUrl([
      { match: "/identities/u1/sessions", result: { ok: true, status: 204, json: {} } },
    ]);
    expect(await revokeIdentitySessions({ id: "u1" })).toMatchObject({
      status: 200,
      body: { revoked: true, id: "u1" },
    });
  });

  it("revokes a single session by id", async () => {
    mockFetchByUrl([{ match: "/sessions/s1", result: { ok: true, status: 204, json: {} } }]);
    expect(await revokeSession({ session_id: "s1" })).toMatchObject({
      status: 200,
      body: { revoked: true, session_id: "s1" },
    });
  });

  it("returns 400 when ids are missing", async () => {
    mockFetchByUrl([]);
    expect(await listIdentitySessions({})).toMatchObject({ status: 400 });
    expect(await revokeSession({})).toMatchObject({ status: 400 });
  });

  it("surfaces a 404 from Kratos", async () => {
    mockFetchByUrl([{ match: "/sessions/none", result: { ok: false, status: 404 } }]);
    expect(await revokeSession({ session_id: "none" })).toMatchObject({ status: 404 });
  });
});
