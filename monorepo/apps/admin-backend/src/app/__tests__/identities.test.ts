import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deactivateIdentity,
  deleteIdentity,
  getIdentity,
  listIdentities,
  setAdminRole,
} from "../handlers/identities";
import { mockFetchByUrl } from "./helpers";

beforeEach(() => {
  process.env.KRATOS_ADMIN_URL = "http://kratos:4434";
});
afterEach(() => vi.unstubAllGlobals());

describe("identity management", () => {
  it("lists identities, passing pagination through", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/identities", result: { ok: true, json: [{ id: "u1" }] } },
    ]);
    const res = await listIdentities({ page_size: 50, page_token: "tok" });
    expect(res.status).toBe(200);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("page_size=50");
    expect(url).toContain("page_token=tok");
  });

  it("gets a single identity by id", async () => {
    mockFetchByUrl([{ match: "/identities/u1", result: { ok: true, json: { id: "u1" } } }]);
    const res = await getIdentity({ id: "u1" });
    expect(res).toMatchObject({ status: 200, body: { id: "u1" } });
  });

  it("returns 400 when id is missing", async () => {
    mockFetchByUrl([]);
    expect(await getIdentity({})).toMatchObject({ status: 400 });
  });

  it("returns 404 when getting a missing identity", async () => {
    mockFetchByUrl([{ match: "/identities/u9", result: { ok: false, status: 404 } }]);
    expect(await getIdentity({ id: "u9" })).toMatchObject({ status: 404 });
  });

  it("deletes an identity and reports the id", async () => {
    mockFetchByUrl([{ match: "/identities/u1", result: { ok: true, status: 204, json: {} } }]);
    expect(await deleteIdentity({ id: "u1" })).toMatchObject({
      status: 200,
      body: { deleted: true, id: "u1" },
    });
  });

  it("deactivates an identity via a JSON Patch to /state", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/identities/u1", result: { ok: true, json: { id: "u1", state: "inactive" } } },
    ]);
    const res = await deactivateIdentity({ id: "u1" });
    expect(res.status).toBe(200);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual([{ op: "replace", path: "/state", value: "inactive" }]);
  });

  it("grants the admin role via metadata_admin", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/identities/u1", result: { ok: true, json: { id: "u1" } } },
    ]);
    await setAdminRole({ id: "u1", admin: true });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual([{ op: "add", path: "/metadata_admin", value: { role: "admin" } }]);
  });

  it("revokes the admin role by emptying metadata_admin", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/identities/u1", result: { ok: true, json: { id: "u1" } } },
    ]);
    await setAdminRole({ id: "u1", admin: false });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual([{ op: "add", path: "/metadata_admin", value: {} }]);
  });
});
