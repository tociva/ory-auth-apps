import { NextRequest, NextResponse } from "next/server";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL;
const KRATOS_ADMIN_URL = process.env.KRATOS_ADMIN_URL!;

export async function POST(req: NextRequest) {
  const { consent_challenge } = await req.json();
// 1. Get consent request info from Hydra
const consentRequestRes = await fetch(
  `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent?consent_challenge=${consent_challenge}`
);
if (!consentRequestRes.ok) {
  throw new Error(`Failed to fetch consent request: ${consentRequestRes.statusText}`);
}
const consentRequest = await consentRequestRes.json();
const subject = consentRequest.subject; // This is the user's Kratos ID
const kratosUserRes = await fetch(`${KRATOS_ADMIN_URL}/identities/${subject}`);
if (!kratosUserRes.ok) {
  const err = await kratosUserRes.json();
  return NextResponse.json({ error: err.error || err }, { status: 500 });
}
const kratosUser = await kratosUserRes.json();
const user = {
  name: kratosUser.traits.name,
  email: kratosUser.traits.email,
  picture: kratosUser.traits.picture,
};
  const hydraRes = await fetch(
    `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(consent_challenge)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_scope: ["openid", "email", "profile", "offline_access"],
        grant_access_token_audience: ['daybook.cloud-users'],
        remember: true,
        remember_for: 3600,
        session: { id_token: {user}, access_token: {user} }
      }),
    }
  );
  const data = await hydraRes.json();
  if (!hydraRes.ok) return NextResponse.json({ error: data.error || data }, { status: 500 });

  return NextResponse.json({ redirect_to: data.redirect_to });
}
