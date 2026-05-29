import { NextRequest, NextResponse } from "next/server";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL;
const KRATOS_ADMIN_URL = process.env.KRATOS_ADMIN_URL!;

export async function POST(req: NextRequest) {
  try {
    const { consent_challenge } = await req.json();
    if (!consent_challenge) {
      return NextResponse.json({ error: "Missing consent_challenge" }, { status: 400 });
    }

    // 1. Get the consent request from Hydra (carries what the client requested).
    const consentRequestRes = await fetch(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(
        consent_challenge
      )}`
    );
    if (!consentRequestRes.ok) {
      const err = await consentRequestRes.text().catch(() => consentRequestRes.statusText);
      return NextResponse.json(
        { error: `Failed to fetch consent request: ${err}` },
        { status: 500 }
      );
    }
    const consentRequest = await consentRequestRes.json();

    // 2. Look up the Kratos identity (subject) to enrich the token claims.
    const subject = consentRequest.subject; // user's Kratos ID
    const kratosUserRes = await fetch(`${KRATOS_ADMIN_URL}/identities/${subject}`);
    if (!kratosUserRes.ok) {
      const err = await kratosUserRes.json().catch(() => null);
      return NextResponse.json({ error: err?.error || err || "Identity lookup failed" }, { status: 500 });
    }
    const kratosUser = await kratosUserRes.json();
    const user = {
      name: kratosUser.traits?.name,
      email: kratosUser.traits?.email,
      picture: kratosUser.traits?.picture,
    };

    // 3. Accept consent, granting ONLY what this client actually requested.
    //    Echoing requested_scope / requested_access_token_audience keeps each
    //    OAuth client's tokens correctly scoped and audience-isolated, which is
    //    essential once multiple apps share this Hydra.
    const hydraRes = await fetch(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(
        consent_challenge
      )}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_scope: consentRequest.requested_scope ?? [],
          grant_access_token_audience: consentRequest.requested_access_token_audience ?? [],
          remember: true,
          remember_for: 3600,
          session: { id_token: { user }, access_token: { user } },
        }),
      }
    );
    const data = await hydraRes.json();
    if (!hydraRes.ok) {
      return NextResponse.json({ error: data.error || data }, { status: 500 });
    }

    return NextResponse.json({ redirect_to: data.redirect_to });
  } catch (err: unknown) {
    console.error("Error accepting consent:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
