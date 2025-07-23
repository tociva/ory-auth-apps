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

export default function ConsentPage() {
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<ConsentRequest | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const consent_challenge = searchParams.get("consent_challenge");

  // 1. Fetch consent details from your backend API
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

  // 2. Accept or Deny handlers
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

  // UI
  if (loading) return <div>Loading consent details...</div>;
  if (error) return <div className="text-red-600 p-4">{error}</div>;
  if (!consent) return <div>No consent request found.</div>;

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
      <h2>Allow access?</h2>
      <p>
        <strong>{consent.client.client_name || consent.client.client_id}</strong>  
        is requesting access to your account.
      </p>
      <p><strong>Requested permissions:</strong></p>
      <ul>
        {consent.requested_scope.map(scope => (
          <li key={scope}>✅ {scope}</li>
        ))}
      </ul>
      <div style={{ margin: "1.5rem 0" }}>
        <button style={{ marginRight: 12 }} onClick={handleAccept}>Accept</button>
        <button onClick={handleDeny}>Deny</button>
      </div>
    </div>
  );
}
