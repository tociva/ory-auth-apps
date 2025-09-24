// Requires Node.js 18+ for built-in fetch.
const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || 'http://localhost:4445';
const CLIENT_ID = "local.daybook.cloud-user-client";
const CLIENT_PAYLOAD = {
  client_id: CLIENT_ID,
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  scope: "openid profile email offline",
  redirect_uris: ["https://app-local.daybook.cloud/auth/callback"],
  post_logout_redirect_uris: ["https://app-local.daybook.cloud/auth/logout"],
  token_endpoint_auth_method: "none",
  client_name: "LocalDaybook User Client",
  audience: ["daybook.cloud-users"]
};

async function deleteHydraClient() {
  try {
    const res = await fetch(`${HYDRA_ADMIN_URL}/clients/${encodeURIComponent(CLIENT_ID)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      console.log(`Client "${CLIENT_ID}" deleted (if it existed).`);
    } else if (res.status === 404) {
      console.log(`Client "${CLIENT_ID}" does not exist (nothing to delete).`);
    } else {
      const error = await res.text();
      throw new Error(`Failed to delete client: ${res.status} ${res.statusText}\n${error}`);
    }
  } catch (err) {
    console.error("Error deleting client:", err.message);
  }
}

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

(async () => {
  await deleteHydraClient();
  await createHydraClient();
})();
