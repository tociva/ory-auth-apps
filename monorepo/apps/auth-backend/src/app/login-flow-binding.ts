/**
 * Pure helpers for binding branded login flows to either an OAuth transaction
 * or a privileged settings re-authentication handoff.
 */
import type { KratosFlow } from "@idnest/shared-types";

export function flowReturnToCandidates(flow: KratosFlow): string[] {
  const candidates: string[] = [];
  if (flow.return_to) candidates.push(flow.return_to);
  if (flow.request_url) {
    try {
      const nested = new URL(flow.request_url).searchParams.get("return_to");
      if (nested) candidates.push(nested);
    } catch {
      // Ignore malformed request_url; callers treat the flow as unbound.
    }
  }
  return candidates;
}

export function transactionTokenFromFlow(
  flow: KratosFlow,
  authBaseUrl: string,
): string | null {
  const authOrigin = new URL(authBaseUrl).origin;
  for (const candidate of flowReturnToCandidates(flow)) {
    try {
      const url = new URL(candidate);
      if (url.origin !== authOrigin || url.pathname !== "/oauth2/login/complete") continue;
      const token = url.searchParams.get("transaction");
      if (token) return token;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/**
 * Kratos interrupts privileged settings (e.g. TOTP enroll) with a refresh login
 * whose return_to points back at settings — not an OAuth completion URL.
 */
export function isSettingsPrivilegedReauthFlow(
  flow: KratosFlow,
  options: { authBaseUrl: string; kratosPublicUrl: string },
): boolean {
  const authOrigin = new URL(options.authBaseUrl).origin;
  const kratosOrigin = new URL(options.kratosPublicUrl).origin;
  for (const candidate of flowReturnToCandidates(flow)) {
    try {
      const url = new URL(candidate);
      if (
        url.origin === authOrigin &&
        (url.pathname === "/settings" || url.pathname === "/settings/return")
      ) {
        return true;
      }
      if (
        url.origin === kratosOrigin &&
        (url.pathname === "/self-service/settings" ||
          url.pathname.startsWith("/self-service/settings/"))
      ) {
        return true;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return false;
}

export function settingsResumeUrlFromFlow(
  flow: KratosFlow,
  options: { authBaseUrl: string; kratosPublicUrl: string },
): string {
  const authOrigin = new URL(options.authBaseUrl).origin;
  const kratosOrigin = new URL(options.kratosPublicUrl).origin;
  for (const candidate of flowReturnToCandidates(flow)) {
    try {
      const url = new URL(candidate);
      if (
        url.origin === authOrigin &&
        (url.pathname === "/settings" || url.pathname === "/settings/return")
      ) {
        return candidate;
      }
      if (
        url.origin === kratosOrigin &&
        (url.pathname === "/self-service/settings" ||
          url.pathname.startsWith("/self-service/settings/"))
      ) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return new URL("/settings", `${options.authBaseUrl}/`).toString();
}
