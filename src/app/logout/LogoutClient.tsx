'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function LogoutClient() {
  const searchParams = useSearchParams();
  const logoutChallenge = useMemo(() => searchParams.get('logout_challenge'), [searchParams]);

  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!logoutChallenge) {
      setError('Missing logout_challenge');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/hydra/accept-logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logout_challenge: logoutChallenge }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || 'Logout failed');
        }

        const data = await res.json();
        if (!cancelled) {
          if (data.redirect_to) {
            window.location.href = data.redirect_to;
          } else {
            setError('No redirect URL from Hydra');
            setLoading(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Logout failed');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logoutChallenge]);

  if (error) return <div className="p-6 text-red-700">Error during logout: {error}</div>;
  return <div className="p-6">{loading ? 'Logging out…' : 'You have been logged out.'}</div>;
}
