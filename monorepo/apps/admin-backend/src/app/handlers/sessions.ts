/**
 * Kratos session management (Phase 3.4). Uses the same no-`/admin`-prefix
 * convention as the existing auth-backend Kratos admin calls
 * (e.g. accept-consent's `/identities/{id}`).
 */
import { getKratosAdminUrl } from "../config";
import { errorBody, readError, type HandlerResult } from "./types";

const base = (): string => getKratosAdminUrl().replace(/\/+$/, "");

export interface IdentitySessionsInput {
  /** Identity whose sessions to list / revoke. */
  id?: string;
}

/** List the active sessions for a given identity. */
export async function listIdentitySessions(input: IdentitySessionsInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    const res = await fetch(`${base()}/identities/${encodeURIComponent(input.id)}/sessions`);
    if (res.status === 404) return { status: 404, body: { error: "Identity not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to list sessions: ${await readError(res)}` } };
    }
    return { status: 200, body: await res.json() };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

/** Revoke (delete) all sessions belonging to an identity. */
export async function revokeIdentitySessions(input: IdentitySessionsInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    const res = await fetch(`${base()}/identities/${encodeURIComponent(input.id)}/sessions`, {
      method: "DELETE",
    });
    if (res.status === 404) return { status: 404, body: { error: "Identity not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to revoke sessions: ${await readError(res)}` } };
    }
    return { status: 200, body: { revoked: true, id: input.id } };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export interface SessionIdInput {
  /** A specific Kratos session id to revoke. */
  session_id?: string;
}

/** Revoke a single session by id. */
export async function revokeSession(input: SessionIdInput): Promise<HandlerResult> {
  try {
    if (!input.session_id) return { status: 400, body: { error: "Missing session_id" } };
    const res = await fetch(`${base()}/sessions/${encodeURIComponent(input.session_id)}`, {
      method: "DELETE",
    });
    if (res.status === 404) return { status: 404, body: { error: "Session not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to revoke session: ${await readError(res)}` } };
    }
    return { status: 200, body: { revoked: true, session_id: input.session_id } };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}
