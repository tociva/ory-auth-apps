import { getHydraAdminUrl } from "../config";
import { errorBody, type HandlerResult } from "./types";

export interface RejectConsentInput {
  consent_challenge?: string;
}

export async function rejectConsent(input: RejectConsentInput): Promise<HandlerResult> {
  const { consent_challenge } = input;
  if (!consent_challenge) {
    return { status: 400, body: { error: "Missing consent_challenge" } };
  }

  try {
    const hydraRes = await fetch(
      `${getHydraAdminUrl()}/oauth2/auth/requests/consent/reject?consent_challenge=${encodeURIComponent(
        consent_challenge,
      )}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "access_denied",
          error_description: "The user denied the request",
        }),
      },
    );
    const data = (await hydraRes.json()) as { redirect_to?: string; error?: unknown };
    if (!hydraRes.ok) {
      return { status: 500, body: { error: data.error || data } };
    }

    return { status: 200, body: { redirect_to: data.redirect_to } };
  } catch (err: unknown) {
    console.error("Error rejecting consent:", err);
    return { status: 500, body: errorBody(err) };
  }
}
