import { Component, DestroyRef, inject, type OnInit, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  TngButtonComponent,
  TngFormFieldComponent,
  TngInputAngularFormsAdapter,
  TngInputComponent,
  TngLabelComponent,
  TngPaginatorComponent,
  TngTableCellTemplate,
  TngTableComponent,
  TngTooltipComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { TngPopover, TngPopoverPanel, TngPopoverTrigger } from "@tailng-ui/primitives";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import {
  type AdminIdentity,
  identityEmail,
  identityName,
} from "../../core/admin-types";
import {
  LIST_PAGE_SIZE_OPTIONS,
  clampListPage,
  matchesListSearch,
  paginateItems,
  parseListPageQuery,
  toListPageQueryParams,
  type ListPageQuery,
} from "../../core/list-page-query";
import { ToastService } from "../../core/toast/toast.service";

interface IdentityRow {
  identity: AdminIdentity;
  searchText: string;
}

@Component({
  selector: "app-identities",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
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
    TngTableCellTemplate,
    TngTableComponent,
    TngTooltipComponent,
  ],
  templateUrl: "./identities.component.html",
  styleUrls: ["./identities.component.css"],
})
export class IdentitiesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly filterPopover = viewChild<TngPopover>("filterPopover");

  rows: IdentityRow[] = [];
  loading = true;
  error = "";

  query: ListPageQuery = {
    q: "",
    status: "",
    page: 1,
    pageSize: 25,
  };

  filterQ = "";

  readonly pageSizeOptions = [...LIST_PAGE_SIZE_OPTIONS];

  readonly columns: TngTableColumn<IdentityRow>[] = [
    { id: "name", label: "Name", accessor: (row) => identityName(row.identity) },
    { id: "email", label: "Email", accessor: (row) => identityEmail(row.identity) },
    { id: "state", label: "State", accessor: (row) => row.identity.state ?? "active" },
    { id: "actions", label: "", align: "end", width: "3.5rem" },
  ];

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.query = parseListPageQuery(params);
      this.filterQ = this.query.q;
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  get filteredRows(): IdentityRow[] {
    return this.rows.filter((row) => matchesListSearch(row.searchText, this.query.q));
  }

  get filteredTotal(): number {
    return this.filteredRows.length;
  }

  get pageIndex(): number {
    return this.clampedPage - 1;
  }

  get pagedRows(): IdentityRow[] {
    return paginateItems(this.filteredRows, this.clampedPage, this.query.pageSize);
  }

  private get clampedPage(): number {
    return clampListPage(this.query.page, this.filteredTotal, this.query.pageSize);
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const identities = await this.api.listIdentities();
      this.rows = identities.map((identity) => this.toRow(identity));
    } catch (e) {
      this.error = describeError(e);
      this.toast.danger(this.error);
    } finally {
      this.loading = false;
    }
  }

  asIdentityRow(row: unknown): IdentityRow {
    return row as IdentityRow;
  }

  applyFilters(): void {
    void this.navigateQuery({
      q: this.filterQ,
      status: "",
      page: 1,
      pageSize: this.query.pageSize,
    });
    this.filterPopover()?.closePopover("programmatic");
  }

  clearFilters(): void {
    this.filterQ = "";
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
      status: "",
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  private navigateQuery(query: ListPageQuery): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toListPageQueryParams(query, { includeStatus: false }),
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  private toRow(identity: AdminIdentity): IdentityRow {
    const name = identityName(identity);
    const email = identityEmail(identity);
    const state = identity.state ?? "active";
    return {
      identity,
      searchText: [name, email, state, identity.id].join(" ").toLowerCase(),
    };
  }
}
