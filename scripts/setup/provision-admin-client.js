// Provision the Idnest Admin console's own Hydra OAuth client.
// Product clients are created and managed through the admin UI.
// Requires Node.js 18+ for built-in fetch.

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const repoRoot = resolve(__dirname, "../..");
for (const envFile of [resolve(repoRoot, ".env"), resolve(repoRoot, "monorepo/.env")]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const env = process.env;

function loadEnvFile(file) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = unquote(match[2].trim());
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

const HYDRA_ADMIN_URL = env.HYDRA_ADMIN_URL || "http://localhost:4445";
const CLIENT_ID = env.ADMIN_OIDC_CLIENT_ID || "idnest-admin-client";
const CLIENT_NAME = env.ADMIN_AUTH_CLIENT_NAME || "Idnest Admin Console";
const CLIENT_AUDIENCE = env.ADMIN_OIDC_AUDIENCE || "idnest-admin";
const CLIENT_SECRET = env.ADMIN_OIDC_CLIENT_SECRET;
const DEFAULT_ADMIN_ORIGIN = "https://admin-dev.idnest.cloud";
const DEFAULT_AUTH_ORIGIN = "https://auth-dev.idnest.cloud";

function csv(value, fallback) {
  const values = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function originOf(url, fallback) {
  try {
    return new URL(url).origin;
  } catch {
    return fallback;
  }
}

const adminOrigin = (env.ADMIN_PUBLIC_ORIGIN || DEFAULT_ADMIN_ORIGIN).replace(/\/+$/, "");
const redirectUris = csv(env.ADMIN_OIDC_REDIRECT_URIS, [
  env.ADMIN_OIDC_REDIRECT_URI || `${adminOrigin}/api/admin/auth/callback`,
]);
const postLogoutRedirectUris = csv(env.ADMIN_AUTH_POST_LOGOUT_REDIRECT_URIS, [
  env.ADMIN_AUTH_POST_LOGOUT_REDIRECT || `${adminOrigin}/auth/logout`,
]);
const clientOrigin = env.ADMIN_AUTH_CLIENT_URI || originOf(redirectUris[0], adminOrigin);
const legalOrigin = env.ADMIN_AUTH_LEGAL_URI || env.AUTH_BASE_URL || env.AUTH_URL || DEFAULT_AUTH_ORIGIN;

const CLIENT_PAYLOAD = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  grant_types: ["authorization_code"],
  response_types: ["code"],
  scope: env.ADMIN_OIDC_SCOPE || "openid profile email",
  redirect_uris: redirectUris,
  post_logout_redirect_uris: postLogoutRedirectUris,
  token_endpoint_auth_method: "client_secret_basic",
  client_name: CLIENT_NAME,
  client_uri: clientOrigin,
  policy_uri: env.ADMIN_AUTH_POLICY_URI || `${legalOrigin.replace(/\/+$/, "")}/privacy`,
  tos_uri: env.ADMIN_AUTH_TOS_URI || `${legalOrigin.replace(/\/+$/, "")}/terms`,
  contacts: csv(env.ADMIN_AUTH_CONTACTS, ["support@idnest.cloud"]),
  metadata: {
    trust_tier: "first_party",
    consent_version: 1,
    remember_offline_access: false,
  },
  audience: csv(CLIENT_AUDIENCE, ["idnest-admin"]),
};

const ADMIN_CLIENTS_BASE = `${HYDRA_ADMIN_URL.replace(/\/+$/, "")}/admin/clients`;

async function deleteHydraClient() {
  const res = await fetch(`${ADMIN_CLIENTS_BASE}/${encodeURIComponent(CLIENT_ID)}`, {
    method: "DELETE",
  });

  if (res.ok) {
    console.log(`Client "${CLIENT_ID}" deleted.`);
    return;
  }
  if (res.status === 404) {
    console.log(`Client "${CLIENT_ID}" does not exist.`);
    return;
  }

  throw new Error(`Failed to delete client: ${res.status} ${res.statusText}\n${await res.text()}`);
}

async function createHydraClient() {
  const response = await fetch(ADMIN_CLIENTS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CLIENT_PAYLOAD),
  });

  if (!response.ok) {
    throw new Error(`Failed to create client: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const created = await response.json();
  console.log(`Client "${created.client_id || CLIENT_ID}" created.`);
}

(async () => {
  if (!CLIENT_SECRET) {
    throw new Error("ADMIN_OIDC_CLIENT_SECRET is required to register the confidential admin client.");
  }
  console.log(`Registering admin Hydra client "${CLIENT_ID}" against ${ADMIN_CLIENTS_BASE}`);
  await deleteHydraClient();
  await createHydraClient();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
