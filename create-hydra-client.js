// Requires Node.js 18+ for built-in fetch. For older Node, use node-fetch.
const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';
const CLIENT_PAYLOAD = {
  client_id: "spa-client",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  scope: "openid profile email offline",
  redirect_uris: ["https://app.daybook.com/auth/callback"],
  post_logout_redirect_uris: ["https://app.daybook.com/"],
  token_endpoint_auth_method: "none",
  client_name: "Daybook SPA"
};

async function createHydraClient() {
  try {
    const response = await fetch(`${HYDRA_ADMIN_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CLIENT_PAYLOAD)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create client: ${response.status} ${response.statusText}\n${error}`);
    }

    const data = await response.json();
    console.log("Client created successfully:", data);
  } catch (err) {
    console.error("Error creating client:", err.message);
  }
}

createHydraClient();
