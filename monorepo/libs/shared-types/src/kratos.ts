/**
 * Kratos identity types + runtime guards shared by the auth backend and
 * frontend. Ported from the original Next.js app's
 * `src/app/util/types/kratos-user.type.ts`.
 */

export interface KratosTraits {
  name?: string;
  email?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface KratosUser {
  id: string;
  traits: KratosTraits;
  [key: string]: unknown;
}

/** The subset of token claims we enrich from a Kratos identity's traits. */
export interface KratosUserClaims {
  name?: string;
  email?: string;
  picture?: string;
}

export interface KratosUiNodeAttributes {
  name?: string;
  value?: unknown;
  type?: string;
  [key: string]: unknown;
}

export interface KratosUiNode {
  type: string;
  group: string;
  attributes: KratosUiNodeAttributes;
  [key: string]: unknown;
}

/** A Kratos self-service flow (login/registration/etc.) with its UI nodes. */
export interface KratosFlow {
  id: string;
  ui: {
    action: string;
    method: string;
    nodes: KratosUiNode[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Browser self-service flows require the `csrf_token` from the flow's UI nodes
 * to be submitted back. Returns the token, or null if the flow has none.
 */
export function getCsrfToken(flow: Pick<KratosFlow, "ui"> | null | undefined): string | null {
  const nodes = flow?.ui?.nodes ?? [];
  const node = nodes.find((n) => n.attributes?.name === "csrf_token");
  const value = node?.attributes?.value;
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Runtime guard: a value is a Kratos identity when it has a string `id` and an
 * object `traits`. Extra fields are allowed (Kratos returns far more).
 */
export function isKratosUser(value: unknown): value is KratosUser {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string") return false;
  if (!isRecord(value.traits)) return false;
  return true;
}

/** Project a Kratos identity's traits into the claims we embed in tokens. */
export function toUserClaims(user: KratosUser): KratosUserClaims {
  return {
    name: user.traits?.name,
    email: user.traits?.email,
    picture: user.traits?.picture,
  };
}
