'use client';

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LogoutPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logout_challenge = searchParams.get("logout_challenge");
    if (!logout_challenge) {
      setError("Missing logout_challenge");
      setLoading(false);
      return;
    }

    fetch("/api/hydra/accept-logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logout_challenge }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then(data => {
        if (data.redirect_to) {
          window.location.href = data.redirect_to;
        } else {
          setError("No redirect URL from Hydra");
          setLoading(false);
        }
      })
      .catch(e => {
        setError(e.message || "Logout failed");
        setLoading(false);
      });
  }, [searchParams]);

  if (error) return <div>Error during logout: {error}</div>;
  return <div>{loading ? "Logging out..." : "You have been logged out."}</div>;
}
