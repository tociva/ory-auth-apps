'use client';
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KratosUser } from "../util/types/kratos-user.type";

const KRATOS_URL = process.env.NEXT_PUBLIC_KRATOS_URL ?? "https://kratos.daybook.com";

export default function HandleLoginReturnPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<KratosUser>();
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // 1. Step: Fetch user session (Kratos)
  useEffect(() => {
    fetch(`${KRATOS_URL}/sessions/whoami`, {
      credentials: "include",
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => setUser(data.identity))
      .catch(e => setError(e.message));
  }, []);

  // 2. Step: Accept login request with Hydra (when user and challenge available)
  useEffect(() => {
    const login_challenge = searchParams.get("login_challenge");
    if (!login_challenge || !user) return;

    async function acceptLogin() {
      setLoading(true);
      try {
        // Call your own backend, which then talks to Hydra admin API
        const res = await fetch(`/api/hydra/accept-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login_challenge,
            subject: user?.id,
            // Optionally pass id_token info if needed for downstream ID tokens
            id_token: {
              name: user?.traits?.name,
              email: user?.traits?.email,
              picture: user?.traits?.picture,
            },
          }),
        });
        if (!res.ok) throw new Error("Failed to accept login challenge");
        const { redirect_to } = await res.json();
        window.location.href = redirect_to;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
        setLoading(false);
      }
    }

    acceptLogin();
  }, [user, searchParams]);

  if (error) return <div>Error: {error}</div>;
  if (!user || loading) return <div>Authenticating and redirecting to consent...</div>;

  // You might never see this (since you'll redirect), but fallback UI:
  return <div>Redirecting...</div>;
}
