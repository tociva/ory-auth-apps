'use client';
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ConsentPage() {
  const searchParams = useSearchParams();
  const consent_challenge = searchParams.get("consent_challenge");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleConsent = async () => {
      if (!consent_challenge) {
        setError("No consent_challenge provided!");
        return;
      }

      try {
        const res = await fetch('/api/hydra/accept-consent', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent_challenge }),
        });
        const data = await res.json();
        if (data.redirect_to) {
          window.location.href = data.redirect_to;
        } else {
          throw new Error("No redirect URL received");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "An unknown error occurred");
      }
    };

    handleConsent();
  }, [consent_challenge]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-xl">
          Error: {error}
        </div>
        <button
          onClick={() => (window.location.href = '/login')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-4">
      <div className="flex justify-center mb-4">
        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
      <h1 className="text-lg font-medium text-gray-800 mb-2 animate-pulse">Authenticating...</h1>
      <p className="text-sm text-gray-500">Verifying session and redirecting you to the consent screen.</p>
    </div>
  );
}
