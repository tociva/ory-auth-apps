'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const KRATOS_URL = process.env.KRATOS_URL ?? "http://localhost:4433";

// Define a type for Kratos error responses
type KratosError = {
  error?: {
    reason?: string;
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export default function ErrorPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<KratosError | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const errorId = searchParams.get('id');
    if (!errorId) return;
    fetch(`${KRATOS_URL}/self-service/errors?id=${errorId}`)
      .then(res => res.json())
      .then(setError)
      .catch(() => setError({ error: { reason: "Could not fetch error details from Kratos." } }));
  }, [searchParams]);

  const handleCopy = () => {
    if (!error) return;
    navigator.clipboard.writeText(JSON.stringify(error, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (!error) return <div className="p-8">Loading error details…</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-lg w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Oops, something went wrong</h1>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700 font-semibold">Error details</span>
          <button
            className="text-sm px-3 py-1 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 transition"
            onClick={handleCopy}
            aria-label="Copy error details"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="text-gray-700">
          <pre className="whitespace-pre-wrap break-all text-sm">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
        <Link href="/" className="mt-6 inline-block text-blue-600 underline">Go back home</Link>
      </div>
    </div>
  );
}
