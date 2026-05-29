/**
 * Hydra OAuth client management (Phase 3.4). Talks to the Hydra *admin* API.
 * Mirrors the payload shape used by tools/create-hydra-clients.mjs so clients
 * created here are consistent with those provisioned from apps.config.json.
 */
import { getHydraAdminUrl } from "../config";
import { errorBody, readError, type HandlerResult } from "./types";

const clientsBase = (): string => `${getHydraAdminUrl().replace(/\/+$/, "")}/admin/clients`;

export interface ClientPayload {
  client_id?: string;
  client_name?: string;
  public?: boolean;
  scope?: string;
  redirect_uris?: string[];
  post_logout_redirect_uris?: string[];
  audience?: string[];
}

/** Required fields for creating a client. */
function validateForCreate(input: ClientPayload): string | null {
  if (!input.client_id) return "client_id is required";
  if (!Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0) {
    return "redirect_uris must be a non-empty array";
  }
  return null;
}

function toHydraPayload(input: ClientPayload) {
  const isPublic = input.public === true;
  return {
    client_id: input.client_id,
    client_name: input.client_name ?? input.client_id,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: input.scope ?? "openid profile email offline_access",
    redirect_uris: input.redirect_uris ?? [],
    post_logout_redirect_uris: input.post_logout_redirect_uris ?? [],
    audience: input.audience ?? [],
    token_endpoint_auth_method: isPublic ? "none" : "client_secret_basic",
  };
}

export async function listClients(): Promise<HandlerResult> {
  try {
    const res = await fetch(clientsBase());
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to list clients: ${await readError(res)}` } };
    }
    return { status: 200, body: await res.json() };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export async function createClient(input: ClientPayload): Promise<HandlerResult> {
  try {
    const invalid = validateForCreate(input);
    if (invalid) return { status: 400, body: { error: invalid } };
    const res = await fetch(clientsBase(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toHydraPayload(input)),
    });
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to create client: ${await readError(res)}` } };
    }
    return { status: 201, body: await res.json() };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export async function updateClient(input: ClientPayload): Promise<HandlerResult> {
  try {
    if (!input.client_id) return { status: 400, body: { error: "client_id is required" } };
    const res = await fetch(`${clientsBase()}/${encodeURIComponent(input.client_id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toHydraPayload(input)),
    });
    if (res.status === 404) return { status: 404, body: { error: "Client not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to update client: ${await readError(res)}` } };
    }
    return { status: 200, body: await res.json() };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}

export interface ClientIdInput {
  client_id?: string;
}

export async function deleteClient(input: ClientIdInput): Promise<HandlerResult> {
  try {
    if (!input.client_id) return { status: 400, body: { error: "client_id is required" } };
    const res = await fetch(`${clientsBase()}/${encodeURIComponent(input.client_id)}`, {
      method: "DELETE",
    });
    if (res.status === 404) return { status: 404, body: { error: "Client not found" } };
    if (!res.ok) {
      return { status: 500, body: { error: `Failed to delete client: ${await readError(res)}` } };
    }
    return { status: 200, body: { deleted: true, client_id: input.client_id } };
  } catch (err) {
    return { status: 500, body: errorBody(err) };
  }
}
