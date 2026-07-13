import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, deleteClient, getClient, updateClient } from "../handlers/clients";
import { mockFetchByUrl } from "./helpers";

beforeEach(() => {
  process.env.HYDRA_ADMIN_URL = "http://hydra:4445";
  process.env.ADMIN_OIDC_CLIENT_ID = "idnest-admin-client";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ADMIN_OIDC_CLIENT_ID;
});

describe("oauth client management", () => {
  it("gets a client by id", async () => {
    mockFetchByUrl([
      { match: "/admin/clients/app1", result: { ok: true, json: { client_id: "app1" } } },
    ]);
    expect(await getClient({ client_id: "app1" })).toMatchObject({
      status: 200,
      body: { client_id: "app1" },
    });
  });

  it("returns 404 when getting a missing client", async () => {
    mockFetchByUrl([{ match: "/admin/clients/none", result: { ok: false, status: 404 } }]);
    expect(await getClient({ client_id: "none" })).toMatchObject({ status: 404 });
  });

  it("creates a public client with PKCE (auth_method=none) and 201", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/admin/clients", result: { ok: true, status: 201, json: { client_id: "app1" } } },
    ]);
    const res = await createClient({
      client_id: "app1",
      public: true,
      redirect_uris: ["https://app1/callback"],
    });
    expect(res.status).toBe(201);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.grant_types).toContain("authorization_code");
  });

  it("defaults confidential clients to client_secret_basic", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/admin/clients", result: { ok: true, status: 201, json: {} } },
    ]);
    await createClient({ client_id: "svc", redirect_uris: ["https://svc/cb"] });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.token_endpoint_auth_method).toBe("client_secret_basic");
  });

  it("preserves remember_offline_access for first-party clients on create", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/admin/clients", result: { ok: true, status: 201, json: {} } },
    ]);
    await createClient({
      client_id: "app1",
      redirect_uris: ["https://app1/cb"],
      metadata: {
        trust_tier: "first_party",
        consent_version: 1,
        remember_offline_access: true,
      },
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.metadata).toMatchObject({
      trust_tier: "first_party",
      consent_version: 1,
      remember_offline_access: true,
    });
  });

  it("rejects remember_offline_access for non-first-party clients on create", async () => {
    const fetchMock = mockFetchByUrl([]);
    const res = await createClient({
      client_id: "partner-app",
      redirect_uris: ["https://partner/cb"],
      metadata: {
        trust_tier: "partner",
        consent_version: 1,
        remember_offline_access: true,
      },
    });

    expect(res).toMatchObject({
      status: 400,
      body: { error: "remember_offline_access is only allowed for first_party clients" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects creation with missing required fields (400)", async () => {
    mockFetchByUrl([]);
    expect(await createClient({ client_id: "x" })).toMatchObject({ status: 400 });
    expect(await createClient({ redirect_uris: ["https://x/cb"] })).toMatchObject({ status: 400 });
  });

  it("updates a client via PUT", async () => {
    mockFetchByUrl([{ match: "/admin/clients/app1", result: { ok: true, json: { client_id: "app1" } } }]);
    expect(await updateClient({ client_id: "app1", redirect_uris: ["https://app1/cb"] })).toMatchObject({
      status: 200,
    });
  });

  it("preserves remember_offline_access for first-party clients on update", async () => {
    const fetchMock = mockFetchByUrl([
      { match: "/admin/clients/app1", result: { ok: true, json: { client_id: "app1" } } },
    ]);
    await updateClient({
      client_id: "app1",
      redirect_uris: ["https://app1/cb"],
      metadata: {
        trust_tier: "first_party",
        consent_version: 2,
        remember_offline_access: true,
      },
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.metadata).toMatchObject({
      trust_tier: "first_party",
      consent_version: 2,
      remember_offline_access: true,
    });
  });

  it("rejects remember_offline_access for non-first-party clients on update", async () => {
    const fetchMock = mockFetchByUrl([]);
    const res = await updateClient({
      client_id: "third-party-app",
      redirect_uris: ["https://third-party/cb"],
      metadata: {
        trust_tier: "third_party",
        consent_version: 1,
        remember_offline_access: true,
      },
    });

    expect(res).toMatchObject({
      status: 400,
      body: { error: "remember_offline_access is only allowed for first_party clients" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects updates to the admin OAuth client", async () => {
    const fetchMock = mockFetchByUrl([]);
    expect(
      await updateClient({
        client_id: "idnest-admin-client",
        redirect_uris: ["https://admin-local.idnest.cloud/auth/callback"],
      }),
    ).toMatchObject({
      status: 403,
      body: { error: "The admin OAuth client cannot be edited" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 when deleting a missing client", async () => {
    mockFetchByUrl([{ match: "/admin/clients/none", result: { ok: false, status: 404 } }]);
    expect(await deleteClient({ client_id: "none" })).toMatchObject({ status: 404 });
  });

  it("rejects deletion of the admin OAuth client", async () => {
    const fetchMock = mockFetchByUrl([]);
    expect(await deleteClient({ client_id: "idnest-admin-client" })).toMatchObject({
      status: 403,
      body: { error: "The admin OAuth client cannot be deleted" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
