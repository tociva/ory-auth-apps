import type {
  AuthBrandDefinition,
  AuthBrandStatus,
  AuthClientConfigStatus,
  AuthenticatorAssuranceLevel,
  AuthPolicyDefinition,
  ConsentMode,
  IdentityGate,
  RegistrationMode,
} from "@idnest/shared-types";
import type { OAuthClientAuthConfigRecord } from "../../core/admin-types";

export interface PolicyDraft extends AuthPolicyDefinition {
  /** Custom OIDC provider ids beyond the known social/external set (one per line). */
  providersText: string;
  domainsText: string;
  emailsText: string;
}

export const KNOWN_OIDC_PROVIDERS: ReadonlyArray<SelectOption> = [
  { value: "google", label: "Google" },
  { value: "apple", label: "Apple" },
  { value: "microsoft", label: "Microsoft" },
  { value: "github", label: "GitHub" },
];

const KNOWN_OIDC_PROVIDER_IDS = new Set(KNOWN_OIDC_PROVIDERS.map((provider) => provider.value));

function splitLines(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface MappingDraft {
  clientId: string;
  brandId: string;
  authPolicyId: string;
  status: AuthClientConfigStatus;
  isFirstParty: boolean;
  consentMode: ConsentMode;
  version?: number;
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

export const NEW_BRAND: AuthBrandDefinition = {
  key: "",
  displayName: "",
  legalName: "",
  productName: "",
  primaryColor: "#2563eb",
  secondaryColor: "#1d4ed8",
  surfaceColor: "#ffffff",
  textColor: "#1f2937",
  mutedTextColor: "#6b7280",
  errorColor: "#b91c1c",
  borderRadius: "16px",
  fontFamily: "system",
  loginHeading: "Sign in to continue",
  loginDescription: "Use your identity to continue.",
  registrationHeading: "Create your account",
  recoveryHeading: "Recover your account",
  consentHeading: "Review access",
  defaultLocale: "en",
};

export const NEW_POLICY: AuthPolicyDefinition = {
  name: "",
  passwordEnabled: false,
  passkeyEnabled: false,
  allowedOidcProviders: [],
  totpEnabled: false,
  minimumAal: "aal1",
  registrationMode: "enabled",
  identityGate: "public",
  allowedEmailDomains: [],
  allowedEmails: [],
  requireVerifiedEmail: true,
  forceReauthentication: false,
  sessionMaximumAgeSeconds: 3600,
};

export const STATUS_OPTIONS: SelectOption<AuthBrandStatus>[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

export const FONT_FAMILY_OPTIONS: SelectOption<"system" | "roboto">[] = [
  { value: "system", label: "System" },
  { value: "roboto", label: "Roboto" },
];

export const AAL_OPTIONS: SelectOption<AuthenticatorAssuranceLevel>[] = [
  { value: "aal1", label: "AAL1" },
  { value: "aal2", label: "AAL2" },
];

export const REGISTRATION_MODE_OPTIONS: SelectOption<RegistrationMode>[] = [
  { value: "enabled", label: "Enabled" },
  { value: "disabled", label: "Disabled" },
  { value: "invitation-only", label: "Invitation only" },
];

export const IDENTITY_GATE_OPTIONS: SelectOption<IdentityGate>[] = [
  { value: "public", label: "Public" },
  { value: "invitation", label: "Invitation required" },
  { value: "existing-identity", label: "Existing users only" },
  { value: "email-allowlist", label: "Email allowlist" },
  { value: "domain-allowlist", label: "Domain allowlist" },
];

export const CONSENT_MODE_OPTIONS: SelectOption<ConsentMode>[] = [
  { value: "always-show", label: "Always show" },
  { value: "skip-for-first-party", label: "Skip first party" },
  { value: "follow-hydra", label: "Follow Hydra" },
];

export const MAPPING_STATUS_OPTIONS: SelectOption<"active" | "disabled">[] = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

export const getSelectValue = <T extends string>(option: SelectOption<T>): T => option.value;
export const getSelectLabel = (option: SelectOption): string => option.label;

export function toMappingDraft(record: OAuthClientAuthConfigRecord): MappingDraft {
  return {
    clientId: record.hydra_client_id,
    brandId: record.brand_id,
    authPolicyId: record.authentication_policy_id,
    status: record.status,
    isFirstParty: record.is_first_party,
    consentMode: record.consent_mode,
    version: record.version,
  };
}

export function toPolicyDraft(definition: AuthPolicyDefinition): PolicyDraft {
  const customProviders = definition.allowedOidcProviders.filter(
    (provider) => !KNOWN_OIDC_PROVIDER_IDS.has(provider),
  );
  return {
    ...structuredClone(definition),
    providersText: customProviders.join("\n"),
    domainsText: definition.allowedEmailDomains.join("\n"),
    emailsText: definition.allowedEmails.join("\n"),
  };
}

export function fromPolicyDraft(draft: PolicyDraft): AuthPolicyDefinition {
  const { providersText, domainsText, emailsText, ...definition } = draft;
  const knownProviders = definition.allowedOidcProviders.filter((provider) =>
    KNOWN_OIDC_PROVIDER_IDS.has(provider),
  );
  const customProviders = splitLines(providersText).filter(
    (provider) => !KNOWN_OIDC_PROVIDER_IDS.has(provider),
  );
  return {
    ...definition,
    sessionMaximumAgeSeconds: Number(definition.sessionMaximumAgeSeconds) || 3600,
    allowedOidcProviders: [...knownProviders, ...customProviders],
    allowedEmailDomains: splitLines(domainsText),
    allowedEmails: splitLines(emailsText),
  };
}

export function isKnownOidcProviderEnabled(draft: PolicyDraft, providerId: string): boolean {
  return draft.allowedOidcProviders.includes(providerId);
}

export function setKnownOidcProviderEnabled(
  draft: PolicyDraft,
  providerId: string,
  enabled: boolean,
): void {
  const without = draft.allowedOidcProviders.filter((provider) => provider !== providerId);
  draft.allowedOidcProviders = enabled ? [...without, providerId] : without;
}

export function policyMethodsLabel(definition: AuthPolicyDefinition): string {
  const methods: string[] = [];
  for (const provider of definition.allowedOidcProviders) {
    methods.push(provider.charAt(0).toUpperCase() + provider.slice(1));
  }
  if (definition.passwordEnabled) methods.push("Password");
  if (definition.passkeyEnabled) methods.push("Passkey");
  if (definition.totpEnabled) methods.push("TOTP");
  return methods.length > 0 ? methods.join(" · ") : "None";
}
