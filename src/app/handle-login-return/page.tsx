'use client';
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KratosUser } from "../util/types/kratos-user.type";

const KRATOS_URL = process.env.NEXT_PUBLIC_KRATOS_URL;
const RETURN_TO = process.env.NEXT_PUBLIC_KRATOS_RETURN_TO;

export default function HandleLoginReturnPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<KratosUser>();
  const [error, setError] = useState<string>("");
  const [, setLoading] = useState(true);

  useEffect(() => {
    let retries = 0;
    const maxRetries = 5;

    async function fetchWhoamiWithRetry() {
      try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
          credentials: "include",
        });

        if (res.status === 401) {
          if (retries < maxRetries) {
            retries++;
            return setTimeout(fetchWhoamiWithRetry, 500);
          } else {
            const loginChallenge = searchParams.get("login_challenge");
            if (loginChallenge) {
              // work around for hydra not setting the cookie
              const returnUrl = `${RETURN_TO}?login_challenge=${encodeURIComponent(loginChallenge)}`;
              window.location.replace(`${KRATOS_URL}/self-service/login/browser?return_to=${encodeURIComponent(returnUrl)}`);
            } else {
              setError("No login challenge found");
              setLoading(false);
            }
            return;
          }
        }

        if (!res.ok) throw new Error("Unexpected error during whoami");
        const data = await res.json();
        setUser(data.identity);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Session error");
        setLoading(false);
      }
    }

    if (document.cookie.includes('ory_kratos_session')) {
      setTimeout(fetchWhoamiWithRetry, 200);
    } else {
      setTimeout(fetchWhoamiWithRetry, 500);
    }
  }, [searchParams]);

  useEffect(() => {
    const login_challenge = searchParams.get("login_challenge");
    if (!login_challenge || !user) return;

    async function acceptLogin() {
      setLoading(true);
      try {
        const res = await fetch(`/api/hydra/accept-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login_challenge,
            subject: user?.id,
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 transition-all duration-300 ease-in-out">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {error ? (
          <div className="text-red-700 bg-red-100 border border-red-300 rounded-lg p-4 animate-fade-in">
            <div className="text-xl font-semibold mb-2">Authentication Error</div>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <h1 className="text-lg font-medium text-gray-800 mb-2 animate-pulse">Authenticating...</h1>
            <p className="text-sm text-gray-500">Verifying session and redirecting you to the consent screen.</p>
          </>
        )}
      </div>
    </div>
  );
}
