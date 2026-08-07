import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import type {
  AuthBrandStatus,
  AuthenticatorAssuranceLevel,
  AuthPolicyDefinition,
  IdentityGate,
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
import type { AuthPolicyRecord } from "../../../../core/admin-types";
import { ToastService } from "../../../../core/toast/toast.service";
import {
  AAL_OPTIONS,
  IDENTITY_GATE_OPTIONS,
  REGISTRATION_MODE_OPTIONS,
  STATUS_OPTIONS,
  policyMethodsLabel,
} from "../../authentication-page.types";

interface PolicyRow {
  id: string;
  name: string;
  status: AuthBrandStatus;
  methods: string;
  minimumAal: AuthenticatorAssuranceLevel;
  registrationMode: RegistrationMode;
  identityGate: IdentityGate;
  version: number;
  updatedAt: string;
  definition: AuthPolicyDefinition;
}

@Component({
  selector: "app-auth-policies",
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
  templateUrl: "./auth-policies.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthPoliciesComponent implements OnInit {
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
    { id: "methods", label: "Methods", accessor: (row) => row.methods, width: "12rem" },
    { id: "status", label: "Status", accessor: (row) => this.statusLabel(row.status) },
    { id: "aal", label: "Assurance", accessor: (row) => this.aalLabel(row.minimumAal) },
    {
      id: "registration",
      label: "Registration",
      accessor: (row) => this.registrationLabel(row.registrationMode),
    },
    {
      id: "identityGate",
      label: "Identity Gate",
      accessor: (row) => this.identityGateLabel(row.identityGate),
    },
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
      const policies = await this.api.listAuthPolicies();
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

  identityGateLabel(value: IdentityGate): string {
    return IDENTITY_GATE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  dateLabel(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : this.dateFormatter.format(date);
  }

  duplicatePolicy(row: PolicyRow): void {
    void this.router.navigate(["/authentication/policies/new"], {
      state: {
        duplicate: {
          ...structuredClone(row.definition),
          name: `${row.name}-copy`,
        } satisfies AuthPolicyDefinition,
      },
    });
  }

  async archivePolicy(row: PolicyRow): Promise<void> {
    if (!window.confirm(`Archive the ${row.name} policy?`)) return;
    this.busyPolicyId = row.id;
    try {
      await this.api.archiveAuthPolicy(row.id);
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

  private toRow(policy: AuthPolicyRecord): PolicyRow {
    return {
      id: policy.id,
      name: policy.definition.name || policy.name,
      status: policy.status,
      methods: policyMethodsLabel(policy.definition),
      minimumAal: policy.definition.minimumAal,
      registrationMode: policy.definition.registrationMode,
      identityGate: policy.definition.identityGate,
      version: policy.version,
      updatedAt: policy.updated_at,
      definition: policy.definition,
    };
  }
}
