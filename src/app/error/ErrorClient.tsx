'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type KratosError = {
  error?: {
    reason?: string;
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type OAuthError = {
  error: string;
  error_description?: string;
  error_hint?: string;
  state?: string;
  [key: string]: unknown;
};

const KRATOS_URL = process.env.NEXT_PUBLIC_KRATOS_URL ?? 'http://localhost:4433';

export default function ErrorClient() {
  const searchParams = useSearchParams();

  // Read once per render
  const errorId = useMemo(() => searchParams.get('id'), [searchParams]);
  const oauthError = useMemo<OAuthError | null>(() => {
    const err = searchParams.get('error');
    if (!err) return null;
    const desc = searchParams.get('error_description') ?? undefined;
    const hint = searchParams.get('error_hint') ?? undefined;
    const state = searchParams.get('state') ?? undefined;

    // Include all query params to help debugging
    const all: Record<string, string> = {};
    // @ts-ignore: searchParams is iterable
    for (const [k, v] of searchParams) all[k] = v;

    return {
      error: err,
      error_description: desc,
      error_hint: hint,
      state,
      query: all,
    } as unknown as OAuthError;
  }, [searchParams]);

  const [error, setError] = useState<KratosError | OAuthError | { error?: { reason?: string } } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1) OAuth error in query → show immediately
    if (oauthError) {
      setError(oauthError);
      return;
    }

    // 2) Kratos error id → fetch from Kratos
    if (errorId) {
      const ac = new AbortController();
      (async () => {
        try {
          const res = await fetch(
            `${KRATOS_URL}/self-service/errors?id=${encodeURIComponent(errorId)}`,
            { signal: ac.signal, cache: 'no-store' }
          );
          const data = await res.json().catch(() => null);
          if (!res.ok || !data) throw new Error('Could not fetch error details from Kratos.');
          setError(data);
        } catch (e) {
          setError({ error: { reason: e instanceof Error ? e.message : 'Unknown fetch error' } });
        }
      })();
      return () => ac.abort();
    }

    // 3) Nothing usable in query
    setError({ error: { reason: 'No error details found in the URL.' } });
  }, [errorId, oauthError]);

  const handleCopy = () => {
    if (!error) return;
    navigator.clipboard.writeText(JSON.stringify(error, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const readableHint = getHumanHint(error);

  if (!error) {
    return <div className="p-8">Loading error details…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Oops, something went wrong</h1>

        {readableHint && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
            <div className="font-semibold mb-1">What this usually means</div>
            <p className="leading-relaxed">{readableHint}</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700 font-semibold">Error details</span>
          <button
            className="text-sm px-3 py-1 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 transition"
            onClick={handleCopy}
            aria-label="Copy error details"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="text-gray-700">
            <pre className="whitespace-pre-wrap break-all text-sm">
              {JSON.stringify(error, null, 2)}
            </pre>
        </div>

        <Link href="/" className="mt-6 inline-block text-blue-600 underline">
          Go back home
        </Link>
      </div>
    </div>
  );
}

/**
 * Provide a quick, human-friendly hint for common cases.
 */
function getHumanHint(err: unknown): string | null {
  // OAuth-style
  if (isOAuthError(err)) {
    const e = err.error;
    const desc = (err.error_description || '').toLowerCase();

    // Very common Hydra/OAuth pitfall
    if (desc.includes('redirect_uri') && desc.includes('does not match')) {
      return 'Your app sent a redirect_uri that is not in the OAuth client’s allowed list. Ensure the exact URL (including scheme, host, port, and path) is registered in your OAuth client (Hydra). For local/dev vs prod, double-check both the value you pass in the authorize request and the client’s allowed redirect URIs.';
    }
    if (e === 'invalid_request') {
      return 'The authorization request is malformed or missing parameters. Verify client_id, redirect_uri, response_type, scope, and that each parameter appears only once.';
    }
    return null;
  }

  // Kratos-style
  if (isKratosError(err)) {
    return null; // Kratos errors are varied; raw JSON is usually most helpful.
  }

  return null;
}

function isOAuthError(v: any): v is OAuthError {
  return !!v && typeof v === 'object' && typeof v.error === 'string' && ('error_description' in v || 'query' in v);
}

function isKratosError(v: any): v is KratosError {
  return !!v && typeof v === 'object' && ('error' in v || 'id' in v);
}
