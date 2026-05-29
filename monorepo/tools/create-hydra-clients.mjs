// Register/refresh one Hydra OAuth client per product app.
//
// Generalizes the original single-client `create-hydra-client.js` to loop over
// the app list in `tools/apps.config.json`. Each app gets its own client_id,
// redirect_uris, post_logout_redirect_uris and audience so tokens stay scoped
// and audience-isolated per app once multiple apps share this Hydra.
//
// Requires Node.js 18+ for built-in fetch. Run with: pnpm hydra:clients
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HYDRA_ADMIN_URL = process.env.HYDRA_ADMIN_URL || "http://localhost:4445";
const ADMIN_CLIENTS_BASE = `${HYDRA_ADMIN_URL.replace(/\/+$/, "")}/admin/clients`;

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, "apps.config.json");

/** @typedef {{
 *   client_id: string;
 *   client_name?: string;
 *   public?: boolean;
 *   scope?: string;
 *   redirect_uris: string[];
 *   post_logout_redirect_uris?: string[];
 *   audience?: string[];
 * }} AppClient */

/** Build the Hydra client payload, enforcing PKCE for public SPA clients. */
function toClientPayload(/** @type {AppClient} */ app) {
  const isPublic = app.public === true;
  return {
    client_id: app.client_id,
    client_name: app.client_name ?? app.client_id,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: app.scope ?? "openid profile email offline_access",
    redirect_uris: app.redirect_uris ?? [],
    post_logout_redirect_uris: app.post_logout_redirect_uris ?? [],
    audience: app.audience ?? [],
    // Public SPAs have no client secret. token_endpoint_auth_method=none makes
    // Hydra require PKCE for this client (see also the global
    // `oauth2.pkce.enforced_for_public_clients=true` server setting).
    token_endpoint_auth_method: isPublic ? "none" : "client_secret_basic",
  };
}

async function deleteHydraClient(/** @type {string} */ clientId) {
  try {
    const res = await fetch(`${ADMIN_CLIENTS_BASE}/${encodeURIComponent(clientId)}`, {
      method: "DELETE",
    });
    if (res.ok) console.log(`Client "${clientId}" deleted (if it existed).`);
    else if (res.status === 404) console.log(`Client "${clientId}" does not exist (nothing to delete).`);
    else throw new Error(`Failed to delete client: ${res.status} ${res.statusText}\n${await res.text()}`);
  } catch (err) {
    console.error(`Error deleting client "${clientId}":`, err);
  }
}

async function createHydraClient(/** @type {AppClient} */ app) {
  const payload = toClientPayload(app);
  try {
    const res = await fetch(ADMIN_CLIENTS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to create client: ${res.status} ${res.statusText}\n${await res.text()}`);
    }
    console.log(`Client "${app.client_id}" created (public=${app.public === true}).`);
  } catch (err) {
    console.error(`Error creating client "${app.client_id}":`, err);
  }
}

async function main() {
  const raw = readFileSync(configPath, "utf8");
  /** @type {{ apps: AppClient[] }} */
  const config = JSON.parse(raw);
  const apps = Array.isArray(config.apps) ? config.apps : [];

  if (!apps.length) {
    console.warn("No apps defined in apps.config.json; nothing to do.");
    return;
  }

  console.log(`Registering ${apps.length} Hydra client(s) against ${ADMIN_CLIENTS_BASE}`);
  for (const app of apps) {
    if (!app.client_id) {
      console.warn("Skipping app entry without a client_id.");
      continue;
    }
    await deleteHydraClient(app.client_id);
    await createHydraClient(app);
  }
}

main();
