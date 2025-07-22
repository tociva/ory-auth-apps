// app/welcome/page.tsx (or .js)
'use client';
import { useEffect, useState } from "react";

const KRATOS_URL = process.env.KRATOS_URL ?? "https://kratos.daybook.com";

export default function WelcomePage() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch(`${KRATOS_URL}/sessions/whoami`, {
      credentials: "include", // send cookies!
    })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => setUser(data.identity))
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div>Not logged in: {error}</div>;
  if (!user) return <div>Loading...</div>;
  return (
    <div>
      <h1>Welcome, {user.traits?.name || user.traits?.email || 'user'}!</h1>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
}
