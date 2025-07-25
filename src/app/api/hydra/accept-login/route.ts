// app/api/hydra/accept-login/route.ts
import { NextRequest, NextResponse } from "next/server";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { login_challenge, subject, id_token } = body;

  try {
    const hydraRes = await fetch(
      `${HYDRA_ADMIN_URL}/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(login_challenge)}`,
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
      }
    );

    if (!hydraRes.ok) {
      const err = await hydraRes.text();
      return NextResponse.json({ error: "Hydra error: " + err }, { status: 500 });
    }

    const data = await hydraRes.json();
    return NextResponse.json({ redirect_to: data.redirect_to });
  } catch (err: unknown) {
    console.error('Error accepting login:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "An unknown error occurred" }, { status: 500 });
  }
}
