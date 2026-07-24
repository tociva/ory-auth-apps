import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type {
  AuthBrandDefinition,
  AuthBrandStatus,
  AuthClientConfigStatus,
  ConsentMode,
  LoginPolicyDefinition,
} from "@idnest/shared-types";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import type {
  AuthBrandRecord,
  AuthConfigurationVersion,
  HydraClient,
  LoginPolicyRecord,
  OAuthClientAuthConfigRecord,
} from "../../core/admin-types";
import { ToastService } from "../../core/toast/toast.service";

interface PolicyDraft extends LoginPolicyDefinition {
  providersText: string;
  domainsText: string;
  emailsText: string;
}

interface MappingDraft {
  clientId: string;
  brandId: string;
  loginPolicyId: string;
  status: AuthClientConfigStatus;
  isFirstParty: boolean;
  consentMode: ConsentMode;
  version?: number;
}

const NEW_BRAND: AuthBrandDefinition = {
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

const NEW_POLICY: LoginPolicyDefinition = {
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

@Component({
  selector: "app-auth-configuration",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./auth-configuration.component.html",
  styleUrls: ["./auth-configuration.component.css"],
})
export class AuthConfigurationComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private destroyed = false;

  brands: AuthBrandRecord[] = [];
  policies: LoginPolicyRecord[] = [];
  clients: HydraClient[] = [];
  mappings: MappingDraft[] = [];
  loading = true;
  saving = false;
  error = "";
  mappingSearch = "";

  brandId: string | null = null;
  brandVersion = 0;
  brandStatus: AuthBrandStatus = "draft";
  brand = structuredClone(NEW_BRAND);
  brandHistory: AuthConfigurationVersion<AuthBrandDefinition>[] = [];

  policyId: string | null = null;
  policyVersion = 0;
  policyStatus: AuthBrandStatus = "draft";
  policy = this.toPolicyDraft(NEW_POLICY);
  policyHistory: AuthConfigurationVersion<LoginPolicyDefinition>[] = [];
  mappingHistory: Record<string, AuthConfigurationVersion<Record<string, unknown>>[]> = {};

  newMapping: MappingDraft = {
    clientId: "",
    brandId: "",
    loginPolicyId: "",
    status: "active",
    isFirstParty: false,
    consentMode: "follow-hydra",
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const [brands, policies, clients, mappings] = await Promise.all([
        this.api.listAuthBrands(),
        this.api.listLoginPolicies(),
        this.api.listClients(),
        this.api.listClientAuthConfigs(),
      ]);
      if (this.destroyed) return;
      this.brands = brands;
      this.policies = policies;
      this.clients = clients;
      this.mappings = mappings.map((mapping) => this.toMappingDraft(mapping));
      this.applyMappingDefaults();
    } catch (error) {
      if (this.destroyed) return;
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.loading = false;
    }
  }

  selectBrand(record?: AuthBrandRecord): void {
    this.brandId = record?.id ?? null;
    this.brandVersion = record?.version ?? 0;
    this.brandStatus = record?.status ?? "draft";
    this.brand = structuredClone(record?.definition ?? NEW_BRAND);
    this.brandHistory = [];
    if (record) void this.loadBrandHistory(record.id);
  }

  duplicateSelectedBrand(): void {
    const source = this.brands.find((record) => record.id === this.brandId);
    if (!source) return;
    this.brandId = null;
    this.brandVersion = 0;
    this.brandStatus = "draft";
    this.brand = {
      ...structuredClone(source.definition),
      key: `${source.key}-copy`,
      displayName: `${source.definition.displayName} Copy`,
      productName: `${source.definition.productName} Copy`,
    };
  }

  selectPolicy(record?: LoginPolicyRecord): void {
    this.policyId = record?.id ?? null;
    this.policyVersion = record?.version ?? 0;
    this.policyStatus = record?.status ?? "draft";
    this.policy = this.toPolicyDraft(record?.definition ?? NEW_POLICY);
    this.policyHistory = [];
    if (record) void this.loadPolicyHistory(record.id);
  }

  duplicateSelectedPolicy(): void {
    const source = this.policies.find((record) => record.id === this.policyId);
    if (!source) return;
    this.policyId = null;
    this.policyVersion = 0;
    this.policyStatus = "draft";
    this.policy = this.toPolicyDraft({
      ...structuredClone(source.definition),
      name: `${source.name}-copy`,
    });
  }

  async saveBrand(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      const saved = this.brandId
        ? await this.api.updateAuthBrand(
            this.brandId,
            this.brandVersion,
            this.brandStatus,
            this.brand,
            "Updated from authentication configuration",
          )
        : await this.api.createAuthBrand(
            this.brandStatus,
            this.brand,
            "Created from authentication configuration",
          );
      this.toast.success(`Saved ${saved.definition.productName}`);
      await this.reload();
      if (!this.destroyed) this.selectBrand(this.brands.find((brand) => brand.id === saved.id));
    } catch (error) {
      this.toast.danger(describeError(error));
    } finally {
      this.saving = false;
    }
  }

  async archiveBrand(record: AuthBrandRecord): Promise<void> {
    if (!window.confirm(`Archive the ${record.definition.productName} brand?`)) return;
    try {
      await this.api.archiveAuthBrand(record.id);
      this.toast.success("Brand archived");
      if (this.brandId === record.id) this.selectBrand();
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  archiveSelectedBrand(): void {
    const record = this.brands.find((brand) => brand.id === this.brandId);
    if (record) void this.archiveBrand(record);
  }

  async savePolicy(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const definition = this.fromPolicyDraft(this.policy);
    try {
      const saved = this.policyId
        ? await this.api.updateLoginPolicy(
            this.policyId,
            this.policyVersion,
            this.policyStatus,
            definition,
            "Updated from authentication configuration",
          )
        : await this.api.createLoginPolicy(
            this.policyStatus,
            definition,
            "Created from authentication configuration",
          );
      this.toast.success(`Saved ${saved.definition.name}`);
      await this.reload();
      if (!this.destroyed) this.selectPolicy(this.policies.find((policy) => policy.id === saved.id));
    } catch (error) {
      this.toast.danger(describeError(error));
    } finally {
      this.saving = false;
    }
  }

  async archivePolicy(record: LoginPolicyRecord): Promise<void> {
    if (!window.confirm(`Archive the ${record.definition.name} policy?`)) return;
    try {
      await this.api.archiveLoginPolicy(record.id);
      this.toast.success("Policy archived");
      if (this.policyId === record.id) this.selectPolicy();
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  archiveSelectedPolicy(): void {
    const record = this.policies.find((policy) => policy.id === this.policyId);
    if (record) void this.archivePolicy(record);
  }

  async saveMapping(mapping: MappingDraft): Promise<void> {
    if (!mapping.clientId || !mapping.brandId || !mapping.loginPolicyId) {
      this.toast.danger("Choose a client, brand, and policy");
      return;
    }
    try {
      const saved = await this.api.saveClientAuthConfig(mapping.clientId, {
        brandId: mapping.brandId,
        loginPolicyId: mapping.loginPolicyId,
        status: mapping.status,
        isFirstParty: mapping.isFirstParty,
        consentMode: mapping.consentMode,
        reason: "Updated from authentication configuration",
      });
      this.toast.success(`Saved authentication configuration for ${saved.hydra_client_id}`);
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  async addMapping(): Promise<void> {
    await this.saveMapping(this.newMapping);
    if (!this.destroyed) {
      this.newMapping = {
        clientId: "",
        brandId: this.brands[0]?.id ?? "",
        loginPolicyId: this.policies[0]?.id ?? "",
        status: "active",
        isFirstParty: false,
        consentMode: "follow-hydra",
      };
    }
  }

  async archiveMapping(mapping: MappingDraft): Promise<void> {
    if (!window.confirm(`Remove the authentication mapping for ${mapping.clientId}?`)) return;
    try {
      await this.api.archiveClientAuthConfig(mapping.clientId);
      this.toast.success("Client authentication mapping archived");
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  unmappedClients(): HydraClient[] {
    const mapped = new Set(this.mappings.map((mapping) => mapping.clientId));
    return this.clients.filter((client) => !mapped.has(client.client_id));
  }

  visibleMappings(): MappingDraft[] {
    const search = this.mappingSearch.trim().toLowerCase();
    return search
      ? this.mappings.filter((mapping) => mapping.clientId.toLowerCase().includes(search))
      : this.mappings;
  }

  clientsUsingBrand(brandId: string): number {
    return this.mappings.filter((mapping) => mapping.brandId === brandId).length;
  }

  async loadMappingHistory(clientId: string): Promise<void> {
    if (this.mappingHistory[clientId]) return;
    try {
      this.mappingHistory = {
        ...this.mappingHistory,
        [clientId]: await this.api.listClientAuthConfigHistory(clientId),
      };
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  private async loadBrandHistory(id: string): Promise<void> {
    try {
      const history = await this.api.listAuthBrandHistory(id);
      if (!this.destroyed && this.brandId === id) this.brandHistory = history;
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  private async loadPolicyHistory(id: string): Promise<void> {
    try {
      const history = await this.api.listLoginPolicyHistory(id);
      if (!this.destroyed && this.policyId === id) this.policyHistory = history;
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  private applyMappingDefaults(): void {
    this.newMapping = {
      ...this.newMapping,
      clientId: this.unmappedClients()[0]?.client_id ?? "",
      brandId: this.brands[0]?.id ?? "",
      loginPolicyId: this.policies[0]?.id ?? "",
    };
  }

  private toMappingDraft(record: OAuthClientAuthConfigRecord): MappingDraft {
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

  private toPolicyDraft(definition: LoginPolicyDefinition): PolicyDraft {
    return {
      ...structuredClone(definition),
      providersText: definition.allowedOidcProviders.join("\n"),
      domainsText: definition.allowedEmailDomains.join("\n"),
      emailsText: definition.allowedEmails.join("\n"),
    };
  }

  private fromPolicyDraft(draft: PolicyDraft): LoginPolicyDefinition {
    const lines = (value: string): string[] =>
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    const {
      providersText,
      domainsText,
      emailsText,
      ...definition
    } = draft;
    return {
      ...definition,
      allowedOidcProviders: lines(providersText),
      allowedEmailDomains: lines(domainsText),
      allowedEmails: lines(emailsText),
    };
  }
}
