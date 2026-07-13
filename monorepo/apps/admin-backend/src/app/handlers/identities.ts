/**
 * Kratos identity management (Phase 3.4). All calls go to the privileged
 * Kratos *admin* API; URLs stay server-side (see config.ts). Handlers are pure
 * (input -> HandlerResult) so they can be unit tested by mocking `fetch`.
 */
import { getKratosAdminUrl } from "../config";
import { errorBody, readError, type HandlerResult } from "./types";

const base = (): string => getKratosAdminUrl().replace(/\/+$/, "");

export interface ListIdentitiesInput {
  /** Page size passthrough (Kratos `page_size`). */
  page_size?: number;
  /** Pagination token passthrough (Kratos `page_token`). */
  page_token?: string;
}

export async function listIdentities(input: ListIdentitiesInput): Promise<HandlerResult> {
  try {
    const params = new URLSearchParams();
    if (input.page_size) params.set("page_size", String(input.page_size));
    if (input.page_token) params.set("page_token", input.page_token);
    const qs = params.toString();
    const res = await fetch(`${base()}/identities${qs ? `?${qs}` : ""}`);
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to list identities: ${await readError(res)}` } };
    }
    return { status: 200, body: await res.json() };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export interface IdentityIdInput {
  id?: string;
}

export async function getIdentity(input: IdentityIdInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    const res = await fetch(`${base()}/identities/${encodeURIComponent(input.id)}`);
    if (res.status === 404) return { status: 404, body: { error: "Identity not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to get identity: ${await readError(res)}` } };
    }
    return { status: 200, body: await res.json() };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export async function deleteIdentity(input: IdentityIdInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    const res = await fetch(`${base()}/identities/${encodeURIComponent(input.id)}`, {
      method: "DELETE",
    });
    if (res.status === 404) return { status: 404, body: { error: "Identity not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to delete identity: ${await readError(res)}` } };
    }
    return { status: 200, body: { deleted: true, id: input.id } };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

/** JSON Patch helper against the Kratos admin identity endpoint. */
async function patchIdentity(
  id: string,
  patch: Array<{ op: string; path: string; value?: unknown }>,
): Promise<HandlerResult> {
  const res = await fetch(`${base()}/identities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.status === 404) return { status: 404, body: { error: "Identity not found" } };
  if (!res.ok) {
    return { status: 500, body: { error: `Failed to update identity: ${await readError(res)}` } };
  }
  return { status: 200, body: await res.json() };
}

/** Deactivate an identity (sets Kratos `state` to `inactive`). */
export async function deactivateIdentity(input: IdentityIdInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    return await patchIdentity(input.id, [{ op: "replace", path: "/state", value: "inactive" }]);
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export interface SetRoleInput {
  id?: string;
  /** Legacy Kratos metadata role flag; not used for Idnest Admin authorization. */
  admin?: boolean;
}

/** Legacy metadata helper. Idnest Admin authorization is backed by client_access_grants. */
export async function setAdminRole(input: SetRoleInput): Promise<HandlerResult> {
  try {
    if (!input.id) return { status: 400, body: { error: "Missing identity id" } };
    const value = input.admin ? { role: "admin" } : {};
    // `add` on an object member sets/replaces it, so this works whether or not
    // metadata_admin already exists.
    return await patchIdentity(input.id, [{ op: "add", path: "/metadata_admin", value }]);
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}
