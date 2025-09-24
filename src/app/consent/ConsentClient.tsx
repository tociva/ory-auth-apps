'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ConsentClient() {
  const searchParams = useSearchParams();
  const consentChallenge = useMemo(() => searchParams.get('consent_challenge'), [searchParams]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!consentChallenge) {
        setError('No consent_challenge provided!');
        return;
      }

      try {
        const res = await fetch('/api/hydra/accept-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent_challenge: consentChallenge }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Consent accept failed');
        }

        const data = await res.json();
        if (data.redirect_to) {
          if (!cancelled) window.location.href = data.redirect_to;
        } else {
          throw new Error('No redirect URL received');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'An unknown error occurred');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [consentChallenge]);

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
      <h1 className="text-lg font-medium text-gray-800 mb-2 animate-pulse">Processing consent…</h1>
      <p className="text-sm text-gray-500">Verifying and redirecting you to the app.</p>
    </div>
  );
}
