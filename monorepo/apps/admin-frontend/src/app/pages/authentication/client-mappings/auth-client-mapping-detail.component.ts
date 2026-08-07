import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardDescriptionComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngCollapsibleComponent,
  TngFormFieldComponent,
  TngInputAngularFormsAdapter,
  TngInputComponent,
  TngLabelComponent,
  TngProgressSpinnerComponent,
  TngSelectComponent,
  TngSwitchComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { AdminApiService, describeError } from "../../../core/admin-api.service";
import type {
  AuthBrandRecord,
  AuthConfigurationVersion,
  AuthPolicyRecord,
  HydraClient,
} from "../../../core/admin-types";
import { ToastService } from "../../../core/toast/toast.service";
import {
  CONSENT_MODE_OPTIONS,
  MAPPING_STATUS_OPTIONS,
  getSelectLabel,
  getSelectValue,
  toMappingDraft,
  type MappingDraft,
  type SelectOption,
} from "../authentication-page.types";

const emptyMapping = (): MappingDraft => ({
  clientId: "",
  brandId: "",
  authPolicyId: "",
  status: "active",
  isFirstParty: false,
  consentMode: "follow-hydra",
});

@Component({
  selector: "app-auth-client-mapping-detail",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardDescriptionComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngCollapsibleComponent,
    TngFormFieldComponent,
    TngIcon,
    TngInputAngularFormsAdapter,
    TngInputComponent,
    TngLabelComponent,
    TngProgressSpinnerComponent,
    TngSelectComponent,
    TngSwitchComponent,
  ],
  templateUrl: "./auth-client-mapping-detail.component.html",
  styleUrls: ["../authentication-page.css"],
})
export class AuthClientMappingDetailComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private destroyed = false;
  private clientId = "";
  private mappedClientIds = new Set<string>();

  brands: AuthBrandRecord[] = [];
  policies: AuthPolicyRecord[] = [];
  clients: HydraClient[] = [];
  history: AuthConfigurationVersion<Record<string, unknown>>[] = [];
  form = emptyMapping();
  reason = "";
  createMode = true;
  loading = true;
  busy = false;
  error = "";
  notice = "";

  readonly consentModeOptions = CONSENT_MODE_OPTIONS;
  readonly mappingStatusOptions = MAPPING_STATUS_OPTIONS;
  readonly getSelectValue = getSelectValue;
  readonly getSelectLabel = getSelectLabel;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get("clientId") ?? "";
    this.createMode = !this.clientId;
    void this.load();
  }

  brandSelectOptions(): SelectOption[] {
    return this.brands.map((brand) => ({
      value: brand.id,
      label: `${brand.definition.productName} (${brand.status})`,
    }));
  }

  policySelectOptions(): SelectOption[] {
    return this.policies.map((policy) => ({
      value: policy.id,
      label: `${policy.definition.name} (${policy.status})`,
    }));
  }

  clientSelectOptions(): SelectOption[] {
    return this.clients
      .filter(
        (client) =>
          client.client_id === this.form.clientId || !this.mappedClientIds.has(client.client_id),
      )
      .map((client) => ({
        value: client.client_id,
        label: client.client_name ? `${client.client_name} (${client.client_id})` : client.client_id,
      }));
  }

  clientDisplayName(): string {
    const client = this.clients.find((candidate) => candidate.client_id === this.form.clientId);
    return client?.client_name?.trim() || this.form.clientId || "New mapping";
  }

  canSave(): boolean {
    return (
      !this.busy &&
      Boolean(this.form.clientId && this.form.brandId && this.form.authPolicyId)
    );
  }

  noAvailableClients(): boolean {
    return this.createMode && this.clientSelectOptions().length === 0;
  }

  onClientChange(value: unknown): void {
    if (typeof value === "string") this.form.clientId = value;
  }

  onBrandChange(value: unknown): void {
    if (typeof value === "string") this.form.brandId = value;
  }

  onPolicyChange(value: unknown): void {
    if (typeof value === "string") this.form.authPolicyId = value;
  }

  onStatusChange(value: unknown): void {
    if (value === "active" || value === "disabled") this.form.status = value;
  }

  onConsentModeChange(value: unknown): void {
    if (
      value === "always-show" ||
      value === "skip-for-first-party" ||
      value === "follow-hydra"
    ) {
      this.form.consentMode = value;
      if (value === "skip-for-first-party") this.form.isFirstParty = true;
    }
  }

  onFirstPartyChange(value: boolean): void {
    this.form.isFirstParty = value;
    if (!value && this.form.consentMode === "skip-for-first-party") {
      this.form.consentMode = "follow-hydra";
    }
  }

  historySummary(version: AuthConfigurationVersion<Record<string, unknown>>): string {
    const value = version.value ?? {};
    const status = this.stringValue(value, "status");
    const brandId = this.stringValue(value, "brandId");
    const policyId =
      this.stringValue(value, "authPolicyId") || this.stringValue(value, "loginPolicyId");
    return [status, brandId, policyId].filter(Boolean).join(" / ") || "Mapping updated";
  }

  async saveMapping(): Promise<void> {
    if (!this.canSave()) {
      this.toast.danger("Choose a client, brand, and policy");
      return;
    }

    const wasCreate = this.createMode;
    await this.run(async () => {
      const saved = await this.api.saveClientAuthConfig(this.form.clientId, {
        brandId: this.form.brandId,
        authPolicyId: this.form.authPolicyId,
        status: this.form.status,
        isFirstParty: this.form.isFirstParty,
        consentMode: this.form.consentMode,
        reason: this.reason.trim() || this.defaultReason(),
      });
      if (this.destroyed) return;

      this.form = toMappingDraft(saved);
      this.clientId = saved.hydra_client_id;
      this.createMode = false;
      this.reason = "";
      this.toast.success(`Saved authentication mapping for ${saved.hydra_client_id}`);

      if (wasCreate) {
        await this.router.navigate(
          ["/authentication/client-mappings", saved.hydra_client_id],
          { replaceUrl: true },
        );
        return;
      }

      this.notice = `Mapping for ${saved.hydra_client_id} saved.`;
      this.history = await this.safeHistory(saved.hydra_client_id);
    });
  }

  async archiveMapping(): Promise<void> {
    if (this.createMode || !this.form.clientId) return;
    if (!window.confirm(`Delete the authentication mapping for ${this.form.clientId}?`)) return;

    await this.run(async () => {
      await this.api.archiveClientAuthConfig(this.form.clientId);
      this.toast.success("Client authentication mapping deleted");
      await this.router.navigate(["/authentication/client-mappings"]);
    });
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      if (this.createMode) {
        const [brands, policies, clients, mappings] = await Promise.all([
          this.api.listAuthBrands(),
          this.api.listAuthPolicies(),
          this.api.listClients(),
          this.api.listClientAuthConfigs(),
        ]);
        if (this.destroyed) return;
        this.brands = brands;
        this.policies = policies;
        this.clients = clients;
        this.mappedClientIds = new Set(mappings.map((mapping) => mapping.hydra_client_id));
        this.form = {
          ...emptyMapping(),
          clientId: this.clientSelectOptions()[0]?.value ?? "",
          brandId: brands[0]?.id ?? "",
          authPolicyId: policies[0]?.id ?? "",
        };
        return;
      }

      const [brands, policies, clients, mapping] = await Promise.all([
        this.api.listAuthBrands(),
        this.api.listAuthPolicies(),
        this.api.listClients(),
        this.api.getClientAuthConfig(this.clientId),
      ]);
      const history = await this.safeHistory(this.clientId);
      if (this.destroyed) return;
      this.brands = brands;
      this.policies = policies;
      this.clients = clients;
      this.form = toMappingDraft(mapping);
      this.history = history;
    } catch (error) {
      if (this.destroyed) return;
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.loading = false;
    }
  }

  private async safeHistory(
    clientId: string,
  ): Promise<AuthConfigurationVersion<Record<string, unknown>>[]> {
    try {
      return await this.api.listClientAuthConfigHistory(clientId);
    } catch {
      return [];
    }
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await fn();
    } catch (error) {
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.busy = false;
    }
  }

  private defaultReason(): string {
    return this.createMode
      ? "Created from authentication client mappings"
      : "Updated from authentication client mappings";
  }

  private stringValue(value: Record<string, unknown>, key: string): string {
    const entry = value[key];
    return typeof entry === "string" ? entry : "";
  }
}
