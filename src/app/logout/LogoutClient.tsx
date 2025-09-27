'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LogoutClient() {
  const searchParams = useSearchParams();
  const logoutChallenge = useMemo(() => searchParams.get('logout_challenge') || '', [searchParams]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!logoutChallenge) {
          setError('Missing logout_challenge');
          setLoading(false);
          return;
        }

        const KRATOS_URL = process.env.NEXT_PUBLIC_KRATOS_URL!;
        if (!KRATOS_URL) throw new Error('NEXT_PUBLIC_KRATOS_URL missing');

        const returnTo = window.location.href;
        const endpoint = `${KRATOS_URL}/self-service/logout/browser?return_to=${encodeURIComponent(returnTo)}`;

        await fetch(endpoint, {
          method: 'GET',
          credentials: 'include',
          redirect: 'follow',
        }).catch(() => {});

        const hydraRes = await fetch('/api/hydra/accept-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logout_challenge: logoutChallenge }),
        });

        if (!hydraRes.ok) {
          const txt = await hydraRes.text().catch(() => '');
          throw new Error(txt || 'Hydra accept failed');
        }

        const { redirect_to } = (await hydraRes.json()) as { redirect_to?: string };
        if (redirect_to) {
          window.location.replace(redirect_to);
        } else {
          setError('No redirect URL from Hydra');
          setLoading(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Logout failed');
        setLoading(false);
      }
    })();
  }, [logoutChallenge]);

  return (
    <div className="min-h-screen w-full bg-primary text-on-primary flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-on-primary/10 bg-on-primary/5 shadow-sm p-6 sm:p-8">
        {/* Loading */}
        {loading && !error && (
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="mt-1 inline-block h-5 w-5 animate-spin rounded-full border-2 border-on-primary/30 border-t-on-primary"
            />
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold">Signing you out…</h2>
              <p className="text-sm text-on-primary/70 mt-1">
                Closing your session securely. This may take a moment.
              </p>
            </div>
          </div>
        )}

        {/* Success (fallback if no redirect_to) */}
        {!loading && !error && (
          <div className="text-center">
            <svg className="mx-auto h-12 w-12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" className="stroke-success/30" strokeWidth="2" />
              <path
                d="M7 12.5l3.2 3.2L17 9.9"
                className="stroke-success"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <h2 className="text-2xl sm:text-3xl font-bold mt-3 text-success">
              You’ve been logged out
            </h2>
            <p className="text-sm sm:text-base text-on-primary/70 mt-1">
              You can safely close this tab or return to the homepage.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold
                         bg-on-primary text-primary hover:bg-on-primary/90 transition focus:outline-none
                         focus:ring-2 focus:ring-offset-2 focus:ring-on-primary/40"
            >
              Go to Homepage
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div>
            <div className="flex items-start gap-3">
              <span className="mt-1 inline-block h-5 w-5 rounded-full bg-danger/20" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-danger">
                  We couldn’t complete the logout
                </h2>
                <p className="text-sm text-on-primary/80 mt-1 break-words">{error}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => location.reload()}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold
                           bg-on-primary text-primary hover:bg-on-primary/90 transition focus:outline-none
                           focus:ring-2 focus:ring-offset-2 focus:ring-on-primary/40"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold
                           border border-on-primary/30 bg-transparent text-on-primary hover:bg-on-primary/10
                           transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-on-primary/40"
              >
                Go to Homepage
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
