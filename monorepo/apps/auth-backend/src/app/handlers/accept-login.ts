import { getHydraAdminUrl } from "../config";
import { errorBody, type HandlerResult } from "./types";

export interface AcceptLoginInput {
  login_challenge?: string;
  subject?: string;
  id_token?: unknown;
}

export async function acceptLogin(input: AcceptLoginInput): Promise<HandlerResult> {
  const { login_challenge, subject, id_token } = input;

  // Phase 2 addition: guard the missing challenge (the open test TODO from the
  // original Next.js handler).
  if (!login_challenge) {
    return { status: 400, body: { error: "Missing login_challenge" } };
  }

  try {
    const hydraRes = await fetch(
      `${getHydraAdminUrl()}/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(
        login_challenge,
      )}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          remember: true,
          remember_for: 3600,
          acr: "aal1",
          context: { id_token },
        }),
      },
    );

    if (!hydraRes.ok) {
      const err = await hydraRes.text();
      return { status: 500, body: { error: "Hydra error: " + err } };
    }

    const data = (await hydraRes.json()) as { redirect_to?: string };
    return { status: 200, body: { redirect_to: data.redirect_to } };
  } catch (err: unknown) {
    console.error("Error accepting login:", err);
    return { status: 500, body: errorBody(err) };
  }
}
