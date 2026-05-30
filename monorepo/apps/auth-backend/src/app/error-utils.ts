/**
 * Error-shaping helpers, ported from the old Angular error page. Kept
 * framework-free so the page route and unit tests can use them directly.
 */

export interface OAuthError {
  error: string;
  error_description?: string;
  error_hint?: string;
  state?: string;
  query?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Whitelist only the fields that are safe to show the end user. Kratos/Hydra
 * error payloads can carry internal detail (stack traces, debug data, identity
 * internals); we never render or copy the raw object.
 */
export function pickSafeDetails(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { message: "No error details available." };
  const e = err as Record<string, unknown>;
  const nested = (e["error"] && typeof e["error"] === "object" ? e["error"] : {}) as Record<
    string,
    unknown
  >;

  const out: Record<string, unknown> = {};
  const code = typeof e["error"] === "string" ? e["error"] : nested["code"] ?? nested["status"];
  if (code !== undefined) out["error"] = code;
  const description = e["error_description"] ?? nested["message"] ?? nested["reason"];
  if (description !== undefined) out["description"] = description;
  if (e["error_hint"] !== undefined) out["hint"] = e["error_hint"];
  const id = e["id"] ?? nested["id"];
  if (id !== undefined) out["reference"] = id;

  return Object.keys(out).length ? out : { message: "An error occurred. Please try again." };
}

function isOAuthError(v: unknown): v is OAuthError {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as OAuthError).error === "string" &&
    ("error_description" in (v as object) || "query" in (v as object))
  );
}

/** A quick, human-friendly hint for common OAuth pitfalls. */
export function getHumanHint(err: unknown): string | null {
  if (isOAuthError(err)) {
    const e = err.error;
    const desc = (err.error_description || "").toLowerCase();

    if (desc.includes("redirect_uri") && desc.includes("does not match")) {
      return "Your app sent a redirect_uri that is not in the OAuth client's allowed list. Ensure the exact URL (including scheme, host, port, and path) is registered in your OAuth client (Hydra).";
    }
    if (e === "invalid_request") {
      return "The authorization request is malformed or missing parameters. Verify client_id, redirect_uri, response_type, scope, and that each parameter appears only once.";
    }
  }
  return null;
}
