import { describe, expect, it } from "vitest";
import {
  canonicalList,
  createAdminSession,
  listHash,
  opaqueHash,
  revokeClientAccess,
  SYSTEM_ADMIN_ROLE,
  touchActiveAdminSession,
} from "./repository";
import type { Db } from "./db";

describe("authz consent key helpers", () => {
  it("canonicalizes list values for stable consent keys", () => {
    expect(canonicalList([" email ", "openid", "email", ""])).toEqual(["email", "openid"]);
  });

  it("hashes equivalent lists identically", () => {
    expect(listHash(["email", "openid"])).toBe(listHash(["openid", "email", "email"]));
  });

  it("hashes opaque session values deterministically", () => {
    expect(opaqueHash("session-token")).toBe(opaqueHash("session-token"));
    expect(opaqueHash("session-token")).not.toBe("session-token");
  });

  it("stores only a hashed admin session token", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return {
          rows: [
            {
              id: "s1",
              identity_id: values[1],
              client_id: values[2],
              role: values[3],
              email: values[4],
              created_at: "now",
              last_seen_at: "now",
              expires_at: "later",
              idle_expires_at: "soon",
            },
          ],
        };
      },
    } as unknown as Db;

    const session = await createAdminSession(db, {
      token: "raw-token",
      identityId: "u1",
      clientId: "idnest-admin-client",
      role: SYSTEM_ADMIN_ROLE,
      email: "admin@example.com",
      ttlSeconds: 300,
      idleTtlSeconds: 60,
    });

    expect(session.role).toBe(SYSTEM_ADMIN_ROLE);
    expect(calls[0].values[0]).toBe(opaqueHash("raw-token"));
    expect(calls[0].values).not.toContain("raw-token");
  });

  it("touches active admin sessions by hashed token", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      query: async (sql: string, values: unknown[]) => {
        calls.push({ sql, values });
        return { rows: [{ id: "s1", identity_id: "u1", client_id: "idnest-admin-client" }] };
      },
    } as unknown as Db;

    await touchActiveAdminSession(db, "raw-token", 1800);

    expect(calls[0].values[0]).toBe(opaqueHash("raw-token"));
    expect(calls[0].values[1]).toBe(1800);
  });

  it("revokes admin sessions when client access is revoked", async () => {
    const sql: string[] = [];
    const db = {
      query: async (query: string) => {
        sql.push(query);
        return { rows: [], rowCount: 1 };
      },
    } as unknown as Db;

    await revokeClientAccess(db, {
      identityId: "u1",
      clientId: "idnest-admin-client",
      revokedBy: "admin",
    });

    expect(sql.some((query) => query.includes("UPDATE client_access_grants"))).toBe(true);
    expect(sql.some((query) => query.includes("UPDATE consent_approvals"))).toBe(true);
    expect(sql.some((query) => query.includes("UPDATE admin_sessions"))).toBe(true);
  });
});
