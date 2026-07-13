import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAuthzPool,
  grantClientAccess,
  migrateAuthzSchema,
  SYSTEM_ADMIN_ROLE,
} from "@idnest/authz-store";
import { loadMonorepoEnv } from "./load-monorepo-env";

loadMonorepoEnv();

interface Identity {
  id: string;
  state?: string;
  traits?: Record<string, unknown>;
  verifiable_addresses?: Array<{ value?: string; verified?: boolean }>;
}

interface AppClient {
  client_id: string;
  metadata?: { trust_tier?: string };
}

function emailOf(identity: Identity): string {
  const email = identity.traits?.["email"];
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isVerified(identity: Identity): boolean {
  const email = emailOf(identity);
  return Boolean(email) && (identity.verifiable_addresses ?? []).some(
    (address) => String(address.value ?? "").trim().toLowerCase() === email && address.verified === true,
  );
}

async function listIdentities(): Promise<Identity[]> {
  const base = process.env.KRATOS_ADMIN_URL;
  if (!base) throw new Error("KRATOS_ADMIN_URL is required");
  const res = await fetch(`${base.replace(/\/+$/, "")}/identities`);
  if (!res.ok) throw new Error(`Failed to list Kratos identities: ${res.status} ${await res.text()}`);
  return (await res.json()) as Identity[];
}

async function main() {
  const url = process.env.AUTHZ_DATABASE_URL;
  if (!url) throw new Error("AUTHZ_DATABASE_URL is required");
  const adminClientId = process.env.ADMIN_OIDC_CLIENT_ID ?? "idnest-admin-client";
  const bootstrapAdminIdentityIds = new Set(
    (process.env.ADMIN_BOOTSTRAP_IDENTITY_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const config = JSON.parse(readFileSync(resolve("tools/apps.config.json"), "utf8")) as { apps: AppClient[] };
  const firstPartyProductClients = (config.apps ?? [])
    .filter((client) => client.client_id !== adminClientId && client.metadata?.trust_tier !== "third_party")
    .map((client) => client.client_id);

  const pool = createAuthzPool(url);
  try {
    await migrateAuthzSchema(pool);
    const identities = await listIdentities();
    let grants = 0;
    for (const identity of identities) {
      if (identity.state === "inactive" || !isVerified(identity)) continue;
      for (const clientId of firstPartyProductClients) {
        await grantClientAccess(pool, { identityId: identity.id, clientId, role: "user", grantedBy: "authz-seed" });
        grants++;
      }
      if (bootstrapAdminIdentityIds.has(identity.id)) {
        await grantClientAccess(pool, {
          identityId: identity.id,
          clientId: adminClientId,
          role: SYSTEM_ADMIN_ROLE,
          grantedBy: "authz-seed",
        });
        grants++;
      }
    }
    console.log(`Seeded ${grants} authz client access grant(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
