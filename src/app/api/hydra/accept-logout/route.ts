import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const logout_challenge = body.logout_challenge;
  if (!logout_challenge) {
    return NextResponse.json({ error: "Missing logout_challenge" }, { status: 400 });
  }

  const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL;

  try {
    const hydraRes = await fetch(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(logout_challenge)}`,
      { method: "PUT", headers: { "Content-Type": "application/json" } }
    );

    if (!hydraRes.ok) {
      const errorText = await hydraRes.text();
      return NextResponse.json({ error: errorText }, { status: 500 });
    }

    const data = await hydraRes.json();
    return NextResponse.json({ redirect_to: data.redirect_to });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "An unknown error occurred" }, { status: 500 });
  }
}
