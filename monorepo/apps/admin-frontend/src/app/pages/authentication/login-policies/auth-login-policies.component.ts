import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { AuthBrandStatus, LoginPolicyDefinition } from "@idnest/shared-types";
import {
  TngBadgeComponent,
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
import { AdminApiService, describeError } from "../../../core/admin-api.service";
import type { AuthConfigurationVersion, LoginPolicyRecord } from "../../../core/admin-types";
import { ToastService } from "../../../core/toast/toast.service";
import {
  AAL_OPTIONS,
  ACCESS_MODE_OPTIONS,
  NEW_POLICY,
  REGISTRATION_MODE_OPTIONS,
  STATUS_OPTIONS,
  fromPolicyDraft,
  getSelectLabel,
  getSelectValue,
  toPolicyDraft,
} from "../authentication-page.types";

@Component({
  selector: "app-auth-login-policies",
  standalone: true,
  imports: [
    FormsModule,
    TngBadgeComponent,
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
  ],
  templateUrl: "./auth-login-policies.component.html",
  styleUrls: ["../authentication-page.css"],
})
export class AuthLoginPoliciesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private destroyed = false;

  policies: LoginPolicyRecord[] = [];
  loading = true;
  saving = false;
  error = "";

  policyId: string | null = null;
  policyVersion = 0;
  policyStatus: AuthBrandStatus = "draft";
  policy = toPolicyDraft(NEW_POLICY);
  policyHistory: AuthConfigurationVersion<LoginPolicyDefinition>[] = [];

  readonly statusOptions = STATUS_OPTIONS;
  readonly aalOptions = AAL_OPTIONS;
  readonly registrationModeOptions = REGISTRATION_MODE_OPTIONS;
  readonly accessModeOptions = ACCESS_MODE_OPTIONS;
  readonly getSelectValue = getSelectValue;
  readonly getSelectLabel = getSelectLabel;

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
      const policies = await this.api.listLoginPolicies();
      if (this.destroyed) return;
      this.policies = policies;
    } catch (error) {
      if (this.destroyed) return;
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.loading = false;
    }
  }

  selectPolicy(record?: LoginPolicyRecord): void {
    this.policyId = record?.id ?? null;
    this.policyVersion = record?.version ?? 0;
    this.policyStatus = record?.status ?? "draft";
    this.policy = toPolicyDraft(record?.definition ?? NEW_POLICY);
    this.policyHistory = [];
    if (record) void this.loadPolicyHistory(record.id);
  }

  duplicateSelectedPolicy(): void {
    const source = this.policies.find((record) => record.id === this.policyId);
    if (!source) return;
    this.policyId = null;
    this.policyVersion = 0;
    this.policyStatus = "draft";
    this.policy = toPolicyDraft({
      ...structuredClone(source.definition),
      name: `${source.name}-copy`,
    });
  }

  async savePolicy(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const definition = fromPolicyDraft(this.policy);
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

  private async loadPolicyHistory(id: string): Promise<void> {
    try {
      const history = await this.api.listLoginPolicyHistory(id);
      if (!this.destroyed && this.policyId === id) this.policyHistory = history;
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }
}
