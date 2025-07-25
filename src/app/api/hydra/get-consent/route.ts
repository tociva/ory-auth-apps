import { NextRequest, NextResponse } from "next/server";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL;

export async function GET(req: NextRequest) {
  const consent_challenge = req.nextUrl.searchParams.get("consent_challenge");
  if (!consent_challenge)
    return NextResponse.json({ error: "Missing consent_challenge" }, { status: 400 });

  const hydraRes = await fetch(
    `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(consent_challenge)}`
  );
  const data = await hydraRes.json();
  if (!hydraRes.ok) return NextResponse.json({ error: data.error || data }, { status: 500 });

  return NextResponse.json({
    challenge: consent_challenge,
    client: data.client,
    requested_scope: data.requested_scope,
    subject: data.subject,
  });
}
