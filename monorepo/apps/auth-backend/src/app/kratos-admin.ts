/**
 * Privileged Kratos Admin API helpers. Never expose these URLs or responses
 * directly to the browser.
 */
import { getKratosAdminUrl } from "./config";
import type { LoginPolicyDefinition } from "@idnest/shared-types";

export type Aal2Capability = "available" | "missing" | "unknown";

interface KratosAdminIdentity {
  id?: string;
  credentials?: Record<string, unknown>;
}

/**
 * Whether the identity already has a second-factor credential that this login
 * policy can use for AAL2 step-up.
 */
export async function identityAal2Capability(
  identityId: string,
  policy: LoginPolicyDefinition,
): Promise<Aal2Capability> {
  const base = getKratosAdminUrl().replace(/\/+$/, "");
  if (!base || !identityId) return "unknown";

  try {
    const response = await fetch(`${base}/identities/${encodeURIComponent(identityId)}`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return "unknown";
    const identity = (await response.json()) as KratosAdminIdentity;
    const credentials = identity.credentials ?? {};
    if (policy.totpEnabled && ("totp" in credentials || "lookup_secret" in credentials)) {
      return "available";
    }
    if (
      policy.passkeyEnabled &&
      ("webauthn" in credentials || "passkey" in credentials)
    ) {
      return "available";
    }
    return "missing";
  } catch {
    return "unknown";
  }
}
