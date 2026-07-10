import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, Router } from "express";
import type { KratosFlow } from "@idnest/shared-types";
import { createPagesRouter } from "../pages";
import { mockFetchByUrl } from "./helpers";

const originalEnv = { ...process.env };

const settingsFlow: KratosFlow = {
  id: "settings-flow-1",
  ui: {
    action: "https://kratos/self-service/settings?flow=settings-flow-1",
    method: "POST",
    nodes: [
      { type: "input", group: "default", attributes: { name: "csrf_token", value: "settings-csrf", type: "hidden" } },
      {
        type: "input",
        group: "oidc",
        attributes: { name: "link", value: "apple", type: "submit" },
        meta: { label: { text: "Link Apple" } },
      },
    ],
  },
};

interface RouteResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

interface ExpressRouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response, next: (err?: unknown) => void) => void | Promise<void> }>;
  };
}

function findGetHandler(router: Router, path: string) {
  const stack = (router as unknown as { stack: ExpressRouteLayer[] }).stack;
  const route = stack.find((layer) => layer.route?.path === path && layer.route.methods.get)?.route;
  if (!route) throw new Error(`Missing GET route ${path}`);
  return route.stack[0].handle;
}

async function requestPath(path: string): Promise<RouteResult> {
  const router = createPagesRouter();
  const url = new URL(path, "https://auth-local.idnest.cloud");
  const handler = findGetHandler(router, url.pathname);
  const result: RouteResult = { status: 200, headers: {}, body: "" };

  const req = {
    query: Object.fromEntries(url.searchParams.entries()),
    headers: {},
  } as Request;

  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    type(value: string) {
      result.headers["content-type"] = value;
      return this;
    },
    send(value: unknown) {
      result.body = String(value);
      return this;
    },
    redirect(target: string) {
      result.status = 302;
      result.headers.location = target;
      return this;
    },
    append(name: string, value: string) {
      result.headers[name.toLowerCase()] = value;
      return this;
    },
  } as unknown as Response;

  await handler(req, res, (err?: unknown) => {
    if (err) throw err;
  });

  return result;
}

beforeEach(() => {
  process.env.AUTH_BASE_URL = "https://auth-local.idnest.cloud";
  process.env.KRATOS_PUBLIC_URL = "https://kratos-local.idnest.cloud";
  process.env.KRATOS_INTERNAL_URL = "http://localhost:4433";
  process.env.CORS_ALLOWED_ORIGINS = "https://app-local.daybook.cloud,https://admin-local.idnest.cloud";
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("settings pages", () => {
  it("redirects unauthenticated users to login and preserves the settings return target", async () => {
    mockFetchByUrl([{ match: "/sessions/whoami", result: { ok: false, status: 401, json: {} } }]);

    const res = await requestPath("/settings?return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount");
    const location = new URL(String(res.headers.location), "https://auth-local.idnest.cloud");

    expect(res.status).toBe(302);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("return_to")).toBe(
      "https://auth-local.idnest.cloud/settings?return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount",
    );
  });

  it("rejects invalid settings return_to values before starting a Kratos flow", async () => {
    const fetchMock = mockFetchByUrl([]);

    const res = await requestPath("/settings?return_to=https%3A%2F%2Fevil.example%2Faccount");

    expect(res.status).toBe(400);
    expect(res.body).toContain("invalid_return_to");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a settings browser flow with an allowlisted product return target", async () => {
    mockFetchByUrl([
      { match: "/sessions/whoami", result: { ok: true, json: { identity: { id: "kratos-id-1", traits: {} } } } },
    ]);

    const res = await requestPath("/settings?return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount");
    const location = new URL(String(res.headers.location));

    expect(res.status).toBe(302);
    expect(location.origin).toBe("https://kratos-local.idnest.cloud");
    expect(location.pathname).toBe("/self-service/settings/browser");
    expect(location.searchParams.get("return_to")).toBe(
      "https://auth-local.idnest.cloud/settings/return?return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount",
    );
  });

  it("renders OIDC settings controls from the Kratos settings flow", async () => {
    mockFetchByUrl([{ match: "/self-service/settings/flows", result: { ok: true, json: settingsFlow } }]);

    const res = await requestPath("/settings?flow=settings-flow-1&return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount");

    expect(res.status).toBe(200);
    expect(res.body).toContain('name="csrf_token" value="settings-csrf"');
    expect(res.body).toContain('name="link" value="apple"');
    expect(res.body).toContain("Link Apple");
    expect(res.body).toContain("Back to app");
  });

  it("redirects settings return to an allowlisted product app", async () => {
    const res = await requestPath("/settings/return?return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://app-local.daybook.cloud/account");
  });

  it("allows login return to continue an internal settings handoff", async () => {
    const res = await requestPath(
      "/login/return?return_to=https%3A%2F%2Fauth-local.idnest.cloud%2Fsettings%3Freturn_to%3Dhttps%253A%252F%252Fapp-local.daybook.cloud%252Faccount",
    );

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      "https://auth-local.idnest.cloud/settings?return_to=https%3A%2F%2Fapp-local.daybook.cloud%2Faccount",
    );
  });

  it("rejects Hydra login return when the Kratos email is not verified", async () => {
    const fetchMock = mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: {
          ok: true,
          json: {
            identity: {
              id: "kratos-id-1",
              traits: { email: "ada@example.com" },
            },
          },
        },
      },
      {
        match: "/identities/",
        result: {
          ok: true,
          json: {
            id: "kratos-id-1",
            traits: { email: "ada@example.com" },
            verifiable_addresses: [{ via: "email", value: "ada@example.com", verified: false }],
          },
        },
      },
    ]);

    const res = await requestPath("/login/return?login_challenge=lc_1");

    expect(res.status).toBe(403);
    expect(res.body).toContain("email_not_verified");
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/requests/login/accept"))).toBe(false);
  });

  it("accepts Hydra login return when the Kratos email is verified", async () => {
    const fetchMock = mockFetchByUrl([
      {
        match: "/sessions/whoami",
        result: {
          ok: true,
          json: {
            identity: {
              id: "kratos-id-1",
              traits: { name: "Ada", email: "ada@example.com", picture: "p.png" },
            },
          },
        },
      },
      {
        match: "/identities/",
        result: {
          ok: true,
          json: {
            id: "kratos-id-1",
            traits: { name: "Ada", email: "ada@example.com", picture: "p.png" },
            verifiable_addresses: [{ via: "email", value: "ada@example.com", verified: true }],
          },
        },
      },
      { match: "/requests/login/accept", result: { ok: true, json: { redirect_to: "https://hydra/continue" } } },
    ]);

    const res = await requestPath("/login/return?login_challenge=lc_1");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://hydra/continue");
    const acceptCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/requests/login/accept"))!;
    const sent = JSON.parse((acceptCall[1] as RequestInit).body as string);
    expect(sent.context.id_token).toEqual({
      name: "Ada",
      email: "ada@example.com",
      email_verified: true,
      picture: "p.png",
    });
  });
});
