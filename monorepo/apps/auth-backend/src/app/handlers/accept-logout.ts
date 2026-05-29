import { getHydraAdminUrl } from "../config";
import { errorBody, type HandlerResult } from "./types";

export interface AcceptLogoutInput {
  logout_challenge?: string;
}

export async function acceptLogout(input: AcceptLogoutInput): Promise<HandlerResult> {
  const { logout_challenge } = input;
  if (!logout_challenge) {
    return { status: 400, body: { error: "Missing logout_challenge" } };
  }

  try {
    const hydraRes = await fetch(
      `${getHydraAdminUrl()}/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(
        logout_challenge,
      )}`,
      { method: "PUT", headers: { "Content-Type": "application/json" } },
    );

    if (!hydraRes.ok) {
      const errorText = await hydraRes.text();
      return { status: 500, body: { error: errorText } };
    }

    const data = (await hydraRes.json()) as { redirect_to?: string };
    return { status: 200, body: { redirect_to: data.redirect_to } };
  } catch (err: unknown) {
    return { status: 500, body: errorBody(err) };
  }
}
