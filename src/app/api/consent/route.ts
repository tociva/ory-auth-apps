// src/app/api/consent/route.ts
import { NextRequest, NextResponse } from 'next/server';

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const consent_challenge = searchParams.get('consent_challenge');

  if (!consent_challenge) {
    return NextResponse.json({ error: "Missing consent_challenge" }, { status: 400 });
  }

  try {
    // 1. Get consent request info from Hydra
    const consentRequestRes = await fetch(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`
    );
    if (!consentRequestRes.ok) {
      throw new Error(`Failed to fetch consent request: ${consentRequestRes.statusText}`);
    }
    const consentRequest = await consentRequestRes.json();

    // 2. Accept consent request (grant all scopes)
    const acceptConsentRes = await fetch(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept?consent_challenge=${consent_challenge}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_scope: consentRequest.requested_scope,
          grant_access_token_audience: consentRequest.requested_access_token_audience,
          session: {},
          remember: true,
          remember_for: 3600,
        }),
      }
    );
    if (!acceptConsentRes.ok) {
      throw new Error(`Failed to accept consent: ${acceptConsentRes.statusText}`);
    }
    const acceptConsent = await acceptConsentRes.json();

    // 3. Redirect user to Hydra's redirect URL
    return NextResponse.redirect(acceptConsent.redirect_to);
  } catch (err: unknown) {
    console.error("Consent error:", JSON.stringify(err ,null, 2));
    return NextResponse.json({ error: "Consent error" }, { status: 500 });
  }
}
