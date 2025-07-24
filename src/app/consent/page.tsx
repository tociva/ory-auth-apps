'use client';
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ConsentRequest = {
  challenge: string;
  client: {
    client_id: string;
    client_name?: string;
  };
  requested_scope: string[];
  subject: string;
};

// Human-readable descriptions for scopes
const scopeDescriptions: Record<string, string> = {
  profile: "Read your basic profile information",
  email: "Access your email address",
  address: "View your saved address",
  phone: "View your phone number",
  // Add custom scopes as needed
  // "myapp:read": "Read your MyApp data",
};

export default function ConsentPage() {
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<ConsentRequest | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Legal checkboxes state
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const consent_challenge = searchParams.get("consent_challenge");

  useEffect(() => {
    if (!consent_challenge) {
      setError("No consent_challenge provided!");
      setLoading(false);
      return;
    }

    fetch(`/api/hydra/get-consent?consent_challenge=${encodeURIComponent(consent_challenge)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setConsent(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [consent_challenge]);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hydra/accept-consent', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent_challenge }),
      });
      const data = await res.json();
      window.location.href = data.redirect_to;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hydra/reject-consent', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent_challenge }),
      });
      const data = await res.json();
      window.location.href = data.redirect_to;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-600 text-lg">Loading consent details...</div>
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex items-center gap-3">
        <span className="w-4 h-4 bg-red-400 inline-block rounded-full mr-2" />
        {error}
      </div>
    </div>
  );
  if (!consent) return (
    <div className="flex items-center justify-center h-screen">
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-6 rounded-xl">
        No consent request found.
      </div>
    </div>
  );

  // Filter out "openid" from user-facing scopes
  const scopesToShow = consent.requested_scope.filter(s => s !== "openid");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg bg-white shadow-xl rounded-2xl border border-gray-100 p-0">
        {/* Header */}
        <div className="rounded-t-2xl bg-blue-600 text-white px-8 py-5">
          <h2 className="text-2xl font-semibold mb-1">Authorize Access</h2>
          <p>
            <span className="font-medium">
              {consent.client.client_name || consent.client.client_id}
            </span>{" "}
            is requesting access to your account.
          </p>
        </div>

        {/* Access Information */}
        <div className="px-8 py-6">
          <p className="font-medium text-gray-800 mb-2">Requested permissions:</p>
          {scopesToShow.length === 0 ? (
            <div className="text-gray-500 pl-2">No personal information access requested.</div>
          ) : (
            <ul className="space-y-3 pl-2">
              {scopesToShow.map(scope => (
                <li key={scope} className="flex items-start gap-3 text-gray-700">
                  <span className="mt-1 w-3 h-3 bg-green-400 rounded-full inline-block flex-shrink-0" />
                  <div>
                    <div className="font-medium">{scopeDescriptions[scope] || `Access: ${scope}`}</div>
                    <div className="text-xs text-gray-400">{scope}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Divider */}
        <div className="px-8">
          <hr className="my-3 border-gray-200" />
        </div>

        {/* Legal Checkboxes */}
        <div className="px-8 pb-6">
          <div className="mb-4 space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="accent-blue-600 h-4 w-4"
                checked={agreedTerms}
                onChange={e => setAgreedTerms(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-700">Terms and Conditions</a>
              </span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="accent-blue-600 h-4 w-4"
                checked={agreedPrivacy}
                onChange={e => setAgreedPrivacy(e.target.checked)}
              />
              <span>
                I agree to the{" "}
                <a href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-700">Privacy Policy</a>
              </span>
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={handleAccept}
              disabled={!agreedTerms || !agreedPrivacy || loading}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-blue-300"
            >
              Accept
            </button>
            <button
              onClick={handleDeny}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold border border-gray-300 hover:bg-gray-200 transition focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
