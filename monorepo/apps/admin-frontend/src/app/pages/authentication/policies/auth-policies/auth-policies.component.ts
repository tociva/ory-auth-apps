import { Component, DestroyRef, inject, type OnInit, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
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
  TngFormFieldComponent,
  TngInputAngularFormsAdapter,
  TngInputComponent,
  TngLabelComponent,
  TngPaginatorComponent,
  TngSelectComponent,
  TngTableCellTemplate,
  TngTableComponent,
  TngTooltipComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { TngPopover, TngPopoverPanel, TngPopoverTrigger } from "@tailng-ui/primitives";
import { AdminApiService, describeError } from "../../../../core/admin-api.service";
import type { AuthPolicyRecord } from "../../../../core/admin-types";
import {
  LIST_PAGE_SIZE_OPTIONS,
  clampListPage,
  matchesListSearch,
  paginateItems,
  parseListPageQuery,
  toListPageQueryParams,
  type ListPageQuery,
} from "../../../../core/list-page-query";
import { ToastService } from "../../../../core/toast/toast.service";
import {
  AAL_OPTIONS,
  IDENTITY_GATE_OPTIONS,
  REGISTRATION_MODE_OPTIONS,
  STATUS_OPTIONS,
  getSelectLabel,
  getSelectValue,
  policyMethodsLabel,
  type SelectOption,
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
  searchText: string;
}

@Component({
  selector: "app-auth-policies",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TngBadgeComponent,
    TngButtonComponent,
    TngFormFieldComponent,
    TngIcon,
    TngInputAngularFormsAdapter,
    TngInputComponent,
    TngLabelComponent,
    TngPaginatorComponent,
    TngPopover,
    TngPopoverPanel,
    TngPopoverTrigger,
    TngSelectComponent,
    TngTableCellTemplate,
    TngTableComponent,
    TngTooltipComponent,
  ],
  templateUrl: "./auth-policies.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthPoliciesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  private destroyed = false;
  private loadRequestId = 0;

  private readonly filterPopover = viewChild<TngPopover>("filterPopover");

  rows: PolicyRow[] = [];
  loading = true;
  error = "";
  busyPolicyId = "";

  query: ListPageQuery = {
    q: "",
    status: "",
    page: 1,
    pageSize: 25,
  };

  filterQ = "";
  filterStatus = "";

  readonly pageSizeOptions = [...LIST_PAGE_SIZE_OPTIONS];
  readonly statusFilterOptions: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...STATUS_OPTIONS,
  ];
  readonly getSelectValue = getSelectValue;
  readonly getSelectLabel = getSelectLabel;

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
    { id: "actions", label: "", align: "end", width: "7.5rem" },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.query = parseListPageQuery(params);
      this.filterQ = this.query.q;
      this.filterStatus = this.query.status;
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  get filteredRows(): PolicyRow[] {
    return this.rows.filter((row) => {
      if (this.query.status && row.status !== this.query.status) return false;
      return matchesListSearch(row.searchText, this.query.q);
    });
  }

  get filteredTotal(): number {
    return this.filteredRows.length;
  }

  get pageIndex(): number {
    return this.clampedPage - 1;
  }

  get pagedRows(): PolicyRow[] {
    return paginateItems(this.filteredRows, this.clampedPage, this.query.pageSize);
  }

  private get clampedPage(): number {
    return clampListPage(this.query.page, this.filteredTotal, this.query.pageSize);
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

  applyFilters(): void {
    void this.navigateQuery({
      q: this.filterQ,
      status: this.filterStatus,
      page: 1,
      pageSize: this.query.pageSize,
    });
    this.filterPopover()?.closePopover("programmatic");
  }

  clearFilters(): void {
    this.filterQ = "";
    this.filterStatus = "";
    void this.navigateQuery({
      q: "",
      status: "",
      page: 1,
      pageSize: this.query.pageSize,
    });
    this.filterPopover()?.closePopover("programmatic");
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    void this.navigateQuery({
      q: this.query.q,
      status: this.query.status,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
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

  private navigateQuery(query: ListPageQuery): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toListPageQueryParams(query),
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }

  private toRow(policy: AuthPolicyRecord): PolicyRow {
    const name = policy.definition.name || policy.name;
    const methods = policyMethodsLabel(policy.definition);
    return {
      id: policy.id,
      name,
      status: policy.status,
      methods,
      minimumAal: policy.definition.minimumAal,
      registrationMode: policy.definition.registrationMode,
      identityGate: policy.definition.identityGate,
      version: policy.version,
      updatedAt: policy.updated_at,
      definition: policy.definition,
      searchText: [name, methods, policy.status].join(" ").toLowerCase(),
    };
  }
}
