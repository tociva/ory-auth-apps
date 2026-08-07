import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import type { AuthBrandStatus, AuthPolicyDefinition } from "@idnest/shared-types";
import {
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardDescriptionComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngCheckboxAngularFormsAdapter,
  TngCheckboxComponent,
  TngCollapsibleComponent,
  TngFormFieldComponent,
  TngInputAngularFormsAdapter,
  TngInputComponent,
  TngLabelComponent,
  TngProgressSpinnerComponent,
  TngSelectComponent,
  TngTextareaComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { AdminApiService, describeError } from "../../../../core/admin-api.service";
import type { AuthConfigurationVersion } from "../../../../core/admin-types";
import { ToastService } from "../../../../core/toast/toast.service";
import {
  AAL_OPTIONS,
  IDENTITY_GATE_OPTIONS,
  KNOWN_OIDC_PROVIDERS,
  NEW_POLICY,
  REGISTRATION_MODE_OPTIONS,
  STATUS_OPTIONS,
  fromPolicyDraft,
  getSelectLabel,
  getSelectValue,
  isKnownOidcProviderEnabled,
  setKnownOidcProviderEnabled,
  toPolicyDraft,
  type PolicyDraft,
} from "../../authentication-page.types";

@Component({
  selector: "app-auth-policy-detail",
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
    TngCheckboxAngularFormsAdapter,
    TngCheckboxComponent,
    TngCollapsibleComponent,
    TngFormFieldComponent,
    TngIcon,
    TngInputAngularFormsAdapter,
    TngInputComponent,
    TngLabelComponent,
    TngProgressSpinnerComponent,
    TngSelectComponent,
    TngTextareaComponent,
  ],
  templateUrl: "./auth-policy-detail.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthPolicyDetailComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private destroyed = false;
  private policyId = "";

  policyVersion = 0;
  policyStatus: AuthBrandStatus = "draft";
  policy: PolicyDraft = toPolicyDraft(NEW_POLICY);
  policyHistory: AuthConfigurationVersion<AuthPolicyDefinition>[] = [];
  createMode = true;
  loading = true;
  saving = false;
  error = "";
  notice = "";

  readonly statusOptions = STATUS_OPTIONS;
  readonly aalOptions = AAL_OPTIONS;
  readonly registrationModeOptions = REGISTRATION_MODE_OPTIONS;
  readonly identityGateOptions = IDENTITY_GATE_OPTIONS;
  readonly knownOidcProviders = KNOWN_OIDC_PROVIDERS;
  readonly getSelectValue = getSelectValue;
  readonly getSelectLabel = getSelectLabel;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    this.policyId = this.route.snapshot.paramMap.get("id") ?? "";
    this.createMode = !this.policyId;
    void this.load();
  }

  policyDisplayName(): string {
    return this.policy.name.trim() || (this.createMode ? "New policy" : "Authentication policy");
  }

  showEmailAllowlist(): boolean {
    return this.policy.identityGate === "email-allowlist";
  }

  showDomainAllowlist(): boolean {
    return this.policy.identityGate === "domain-allowlist";
  }

  isProviderEnabled(providerId: string): boolean {
    return isKnownOidcProviderEnabled(this.policy, providerId);
  }

  onProviderEnabledChange(providerId: string, enabled: boolean): void {
    setKnownOidcProviderEnabled(this.policy, providerId, enabled);
  }

  async savePolicy(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.error = "";
    this.notice = "";
    const wasCreate = this.createMode;
    const definition = fromPolicyDraft(this.policy);
    try {
      const saved = this.createMode
        ? await this.api.createAuthPolicy(
            this.policyStatus,
            definition,
            "Created from authentication configuration",
          )
        : await this.api.updateAuthPolicy(
            this.policyId,
            this.policyVersion,
            this.policyStatus,
            definition,
            "Updated from authentication configuration",
          );
      if (this.destroyed) return;

      this.toast.success(`Saved ${saved.definition.name}`);
      this.policyId = saved.id;
      this.policyVersion = saved.version;
      this.policyStatus = saved.status;
      this.policy = toPolicyDraft(saved.definition);
      this.createMode = false;

      if (wasCreate) {
        await this.router.navigate(["/authentication/policies", saved.id], {
          replaceUrl: true,
        });
        return;
      }

      this.notice = `Policy ${saved.definition.name} saved.`;
      this.policyHistory = await this.safeHistory(saved.id);
    } catch (error) {
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.saving = false;
    }
  }

  async archivePolicy(): Promise<void> {
    if (this.createMode || !this.policyId) return;
    if (!window.confirm(`Archive the ${this.policy.name || "selected"} policy?`)) return;
    this.saving = true;
    this.error = "";
    try {
      await this.api.archiveAuthPolicy(this.policyId);
      this.toast.success("Policy archived");
      await this.router.navigate(["/authentication/policies"]);
    } catch (error) {
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.saving = false;
    }
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      if (this.createMode) {
        this.applyDuplicateState();
        return;
      }

      const policies = await this.api.listAuthPolicies();
      if (this.destroyed) return;
      const record = policies.find((policy) => policy.id === this.policyId);
      if (!record) {
        this.error = "Authentication policy not found";
        this.toast.danger(this.error);
        return;
      }

      this.policyVersion = record.version;
      this.policyStatus = record.status;
      this.policy = toPolicyDraft(record.definition);
      this.policyHistory = await this.safeHistory(record.id);
    } catch (error) {
      if (this.destroyed) return;
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.loading = false;
    }
  }

  private applyDuplicateState(): void {
    const state = window.history.state as { duplicate?: unknown };
    const duplicate = state.duplicate;
    if (duplicate && typeof duplicate === "object") {
      this.policy = toPolicyDraft(duplicate as AuthPolicyDefinition);
      this.policyStatus = "draft";
      this.policyVersion = 0;
      const nextState = { ...state };
      delete nextState.duplicate;
      window.history.replaceState(nextState, "", window.location.href);
    } else {
      this.policy = toPolicyDraft(NEW_POLICY);
      this.policyStatus = "draft";
      this.policyVersion = 0;
    }
  }

  private async safeHistory(
    id: string,
  ): Promise<AuthConfigurationVersion<AuthPolicyDefinition>[]> {
    try {
      return await this.api.listAuthPolicyHistory(id);
    } catch {
      return [];
    }
  }
}
