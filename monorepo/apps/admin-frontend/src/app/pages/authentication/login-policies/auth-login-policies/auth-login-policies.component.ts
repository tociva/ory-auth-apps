import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import type {
  AuthBrandStatus,
  AuthenticatorAssuranceLevel,
  ClientAccessMode,
  LoginPolicyDefinition,
  RegistrationMode,
} from "@idnest/shared-types";
import {
  TngBadgeComponent,
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardDescriptionComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngTableCellTemplate,
  TngTableComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { AdminApiService, describeError } from "../../../../core/admin-api.service";
import type { LoginPolicyRecord } from "../../../../core/admin-types";
import { ToastService } from "../../../../core/toast/toast.service";
import {
  AAL_OPTIONS,
  ACCESS_MODE_OPTIONS,
  REGISTRATION_MODE_OPTIONS,
  STATUS_OPTIONS,
} from "../../authentication-page.types";

interface PolicyRow {
  id: string;
  name: string;
  status: AuthBrandStatus;
  minimumAal: AuthenticatorAssuranceLevel;
  registrationMode: RegistrationMode;
  accessMode: ClientAccessMode;
  version: number;
  updatedAt: string;
  definition: LoginPolicyDefinition;
}

@Component({
  selector: "app-auth-login-policies",
  standalone: true,
  imports: [
    RouterLink,
    TngBadgeComponent,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardDescriptionComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngIcon,
    TngTableCellTemplate,
    TngTableComponent,
  ],
  templateUrl: "./auth-login-policies.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthLoginPoliciesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  private destroyed = false;
  private loadRequestId = 0;

  rows: PolicyRow[] = [];
  loading = true;
  error = "";
  busyPolicyId = "";

  readonly columns: TngTableColumn<PolicyRow>[] = [
    { id: "name", label: "Name", accessor: (row) => row.name, width: "16rem" },
    { id: "status", label: "Status", accessor: (row) => this.statusLabel(row.status) },
    { id: "aal", label: "Minimum AAL", accessor: (row) => this.aalLabel(row.minimumAal) },
    {
      id: "registration",
      label: "Registration",
      accessor: (row) => this.registrationLabel(row.registrationMode),
    },
    { id: "access", label: "Access", accessor: (row) => this.accessLabel(row.accessMode) },
    {
      id: "updated",
      label: "Updated",
      accessor: (row) => this.dateLabel(row.updatedAt),
      width: "12rem",
    },
    { id: "actions", label: "", align: "end", width: "16rem" },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.error = "";
    try {
      const policies = await this.api.listLoginPolicies();
      if (!this.isActiveLoad(requestId)) return;
      this.rows = policies.map((policy) => this.toRow(policy));
    } catch (error) {
      const message = describeError(error);
      if (!this.isActiveLoad(requestId)) return;
      this.error = message;
      this.toast.danger(message);
    } finally {
      if (this.isActiveLoad(requestId)) this.loading = false;
    }
  }

  asPolicyRow(row: unknown): PolicyRow {
    return row as PolicyRow;
  }

  statusLabel(value: AuthBrandStatus): string {
    return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  aalLabel(value: AuthenticatorAssuranceLevel): string {
    return AAL_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  registrationLabel(value: RegistrationMode): string {
    return REGISTRATION_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  accessLabel(value: ClientAccessMode): string {
    return ACCESS_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  dateLabel(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : this.dateFormatter.format(date);
  }

  duplicatePolicy(row: PolicyRow): void {
    void this.router.navigate(["/authentication/login-policies/new"], {
      state: {
        duplicate: {
          ...structuredClone(row.definition),
          name: `${row.name}-copy`,
        } satisfies LoginPolicyDefinition,
      },
    });
  }

  async archivePolicy(row: PolicyRow): Promise<void> {
    if (!window.confirm(`Archive the ${row.name} policy?`)) return;
    this.busyPolicyId = row.id;
    try {
      await this.api.archiveLoginPolicy(row.id);
      this.toast.success("Policy archived");
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    } finally {
      if (!this.destroyed) this.busyPolicyId = "";
    }
  }

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }

  private toRow(policy: LoginPolicyRecord): PolicyRow {
    return {
      id: policy.id,
      name: policy.definition.name || policy.name,
      status: policy.status,
      minimumAal: policy.definition.minimumAal,
      registrationMode: policy.definition.registrationMode,
      accessMode: policy.definition.accessMode,
      version: policy.version,
      updatedAt: policy.updated_at,
      definition: policy.definition,
    };
  }
}
