import { NextRequest, NextResponse } from "next/server";

const HYDRA_ADMIN_URL = process.env.NEXT_PUBLIC_HYDRA_ADMIN_URL;

export async function POST(req: NextRequest) {
  const { consent_challenge } = await req.json();

  const hydraRes = await fetch(
    `${HYDRA_ADMIN_URL}/oauth2/auth/requests/consent/accept?consent_challenge=${encodeURIComponent(consent_challenge)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_scope: ["openid", "email", "profile"], // Or use the requested scopes dynamically
        remember: true,
        remember_for: 3600,
        session: { id_token: { custom: "data" } }, // Add user info here if needed
      }),
    }
  );
  const data = await hydraRes.json();
  if (!hydraRes.ok) return NextResponse.json({ error: data.error || data }, { status: 500 });

  return NextResponse.json({ redirect_to: data.redirect_to });
}
