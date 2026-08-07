export type OAuthClientType = "spa" | "web" | "service" | "native" | "custom";
export type KnownOAuthClientType = Exclude<OAuthClientType, "custom">;

export interface OAuthClientProfile {
  type: KnownOAuthClientType;
  label: string;
  description: string;
  grantTypes: readonly string[];
  responseTypes: readonly string[];
  tokenEndpointAuthMethod: "none" | "client_secret_basic";
  requiresRedirectUris: boolean;
  supportsPostLogoutRedirectUris: boolean;
  defaultScope: string;
}

export const OAUTH_CLIENT_PROFILES: Record<KnownOAuthClientType, OAuthClientProfile> = {
  spa: {
    type: "spa",
    label: "Single-page app",
    description: "Browser app using authorization code with PKCE.",
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "none",
    requiresRedirectUris: true,
    supportsPostLogoutRedirectUris: true,
    defaultScope: "openid profile email offline_access",
  },
  service: {
    type: "service",
    label: "Machine-to-machine",
    description: "Backend service using client credentials.",
    grantTypes: ["client_credentials"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "client_secret_basic",
    requiresRedirectUris: false,
    supportsPostLogoutRedirectUris: false,
    defaultScope: "",
  },
  web: {
    type: "web",
    label: "Server web app",
    description: "Server-rendered app with a confidential client secret.",
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "client_secret_basic",
    requiresRedirectUris: true,
    supportsPostLogoutRedirectUris: true,
    defaultScope: "openid profile email offline_access",
  },
  native: {
    type: "native",
    label: "Native app",
    description: "Installed app using authorization code with PKCE.",
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "none",
    requiresRedirectUris: true,
    supportsPostLogoutRedirectUris: false,
    defaultScope: "openid profile email offline_access",
  },
};

export const KNOWN_OAUTH_CLIENT_TYPES: readonly KnownOAuthClientType[] = [
  "spa",
  "service",
  "web",
  "native",
];

export function isKnownOAuthClientType(value: unknown): value is KnownOAuthClientType {
  return typeof value === "string" && KNOWN_OAUTH_CLIENT_TYPES.includes(value as KnownOAuthClientType);
}
