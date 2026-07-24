export type AuthBrandStatus = "draft" | "active" | "disabled" | "archived";
export type AuthClientConfigStatus = "active" | "disabled" | "archived";
export type ConsentMode = "always-show" | "skip-for-first-party" | "follow-hydra";
export type RegistrationMode = "enabled" | "disabled" | "invitation-only";
export type ClientAccessMode = "open" | "grant-required";
export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

export interface AuthBrandDefinition {
  key: string;
  displayName: string;
  legalName: string;
  productName: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  logoCompactUrl?: string;
  faviconUrl?: string;
  backgroundImageUrl?: string;
  illustrationUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  errorColor: string;
  borderRadius: string;
  fontFamily: "system" | "roboto";
  loginHeading: string;
  loginDescription: string;
  registrationHeading: string;
  recoveryHeading: string;
  consentHeading: string;
  supportUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  copyrightText?: string;
  defaultLocale: string;
}

export interface LoginPolicyDefinition {
  name: string;
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  allowedOidcProviders: string[];
  totpEnabled: boolean;
  minimumAal: AuthenticatorAssuranceLevel;
  registrationMode: RegistrationMode;
  accessMode: ClientAccessMode;
  allowedEmailDomains: string[];
  allowedEmails: string[];
  requireVerifiedEmail: boolean;
  forceReauthentication: boolean;
  sessionMaximumAgeSeconds: number;
}

export interface OAuthClientAuthConfigSnapshot {
  hydraClientId: string;
  clientDisplayName?: string;
  status: AuthClientConfigStatus;
  isFirstParty: boolean;
  consentMode: ConsentMode;
  brandId: string;
  brandVersion: number;
  loginPolicyId: string;
  loginPolicyVersion: number;
  mappingVersion: number;
}

export interface ResolvedAuthConfiguration {
  client: OAuthClientAuthConfigSnapshot;
  brand: AuthBrandDefinition;
  policy: LoginPolicyDefinition;
  usedFallback: boolean;
}

export interface PublicAuthPolicy {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  allowedOidcProviders: string[];
  totpEnabled: boolean;
  minimumAal: AuthenticatorAssuranceLevel;
  registrationMode: RegistrationMode;
}

export interface PublicAuthContext {
  transactionId: string;
  client: {
    id: string;
    displayName: string;
  };
  brand: AuthBrandDefinition;
  policy: PublicAuthPolicy;
  expiresAt: string;
  /** oauth (default) or privileged settings re-authentication. */
  purpose?: "oauth" | "settings_reauth";
  /** Present when AAL2 is required but no interactive second-factor UI is available. */
  secondaryFactorEnrollmentUrl?: string;
  /** Where to send the browser if settings re-auth is cancelled. */
  settingsResumeUrl?: string;
}

export const DEFAULT_IDNEST_BRAND: AuthBrandDefinition = {
  key: "idnest-default",
  displayName: "Idnest",
  legalName: "Tociva Technologies",
  productName: "Idnest",
  primaryColor: "#2563eb",
  secondaryColor: "#1d4ed8",
  surfaceColor: "#ffffff",
  textColor: "#1f2937",
  mutedTextColor: "#6b7280",
  errorColor: "#b91c1c",
  borderRadius: "16px",
  fontFamily: "system",
  loginHeading: "Sign in to continue",
  loginDescription: "Use your Idnest identity to continue.",
  registrationHeading: "Create your account",
  recoveryHeading: "Recover your account",
  consentHeading: "Review access",
  supportUrl: "https://idnest.cloud/support",
  privacyUrl: "https://auth.idnest.cloud/privacy",
  termsUrl: "https://auth.idnest.cloud/terms",
  copyrightText: "Tociva Technologies",
  defaultLocale: "en",
};

export const DEFAULT_LOGIN_POLICY: LoginPolicyDefinition = {
  name: "Default Idnest policy",
  passwordEnabled: false,
  passkeyEnabled: false,
  allowedOidcProviders: ["google", "apple"],
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

export function toPublicPolicy(policy: LoginPolicyDefinition): PublicAuthPolicy {
  return {
    passwordEnabled: policy.passwordEnabled,
    passkeyEnabled: policy.passkeyEnabled,
    allowedOidcProviders: [...policy.allowedOidcProviders],
    totpEnabled: policy.totpEnabled,
    minimumAal: policy.minimumAal,
    registrationMode: policy.registrationMode,
  };
}
