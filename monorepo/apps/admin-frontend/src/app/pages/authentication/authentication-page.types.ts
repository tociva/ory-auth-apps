import type {
  AuthBrandDefinition,
  AuthBrandStatus,
  AuthClientConfigStatus,
  AuthenticatorAssuranceLevel,
  ClientAccessMode,
  ConsentMode,
  LoginPolicyDefinition,
  RegistrationMode,
} from "@idnest/shared-types";
import type { OAuthClientAuthConfigRecord } from "../../core/admin-types";

export interface PolicyDraft extends LoginPolicyDefinition {
  providersText: string;
  domainsText: string;
  emailsText: string;
}

export interface MappingDraft {
  clientId: string;
  brandId: string;
  loginPolicyId: string;
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

export const NEW_POLICY: LoginPolicyDefinition = {
  name: "",
  passwordEnabled: false,
  passkeyEnabled: false,
  allowedOidcProviders: [],
  totpEnabled: false,
  minimumAal: "aal1",
  registrationMode: "enabled",
  accessMode: "open",
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

export const ACCESS_MODE_OPTIONS: SelectOption<ClientAccessMode>[] = [
  { value: "open", label: "Open" },
  { value: "grant-required", label: "Grant required" },
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
    loginPolicyId: record.login_policy_id,
    status: record.status,
    isFirstParty: record.is_first_party,
    consentMode: record.consent_mode,
    version: record.version,
  };
}

export function toPolicyDraft(definition: LoginPolicyDefinition): PolicyDraft {
  return {
    ...structuredClone(definition),
    providersText: definition.allowedOidcProviders.join("\n"),
    domainsText: definition.allowedEmailDomains.join("\n"),
    emailsText: definition.allowedEmails.join("\n"),
  };
}

export function fromPolicyDraft(draft: PolicyDraft): LoginPolicyDefinition {
  const lines = (value: string): string[] =>
    value
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  const { providersText, domainsText, emailsText, ...definition } = draft;
  return {
    ...definition,
    sessionMaximumAgeSeconds: Number(definition.sessionMaximumAgeSeconds) || 3600,
    allowedOidcProviders: lines(providersText),
    allowedEmailDomains: lines(domainsText),
    allowedEmails: lines(emailsText),
  };
}
