import { Component, DestroyRef, inject, type OnInit, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import type { AuthBrandDefinition, AuthBrandStatus } from "@idnest/shared-types";
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
import type { AuthBrandRecord } from "../../../../core/admin-types";
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
  STATUS_OPTIONS,
  getSelectLabel,
  getSelectValue,
  type SelectOption,
} from "../../authentication-page.types";

interface BrandRow {
  id: string;
  key: string;
  productName: string;
  primaryColor: string;
  status: AuthBrandStatus;
  clientCount: number;
  version: number;
  updatedAt: string;
  definition: AuthBrandDefinition;
  searchText: string;
}

@Component({
  selector: "app-auth-brands",
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
  templateUrl: "./auth-brands.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthBrandsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  private readonly rowSorter = new Intl.Collator(undefined, { sensitivity: "base" });
  private destroyed = false;
  private loadRequestId = 0;

  private readonly filterPopover = viewChild<TngPopover>("filterPopover");

  rows: BrandRow[] = [];
  loading = true;
  error = "";
  busyBrandId = "";

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

  readonly columns: TngTableColumn<BrandRow>[] = [
    { id: "product", label: "Product", accessor: (row) => row.productName, width: "18rem" },
    { id: "status", label: "Status", accessor: (row) => this.statusLabel(row.status) },
    {
      id: "clients",
      label: "Clients",
      accessor: (row) => String(row.clientCount),
      width: "8rem",
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

  get filteredRows(): BrandRow[] {
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

  get pagedRows(): BrandRow[] {
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
      const [brands, mappings] = await Promise.all([
        this.api.listAuthBrands(),
        this.api.listClientAuthConfigs(),
      ]);
      if (!this.isActiveLoad(requestId)) return;
      const clientCounts = new Map<string, number>();
      for (const mapping of mappings) {
        clientCounts.set(mapping.brand_id, (clientCounts.get(mapping.brand_id) ?? 0) + 1);
      }
      this.rows = brands
        .map((brand) => this.toRow(brand, clientCounts.get(brand.id) ?? 0))
        .sort((a, b) => this.rowSorter.compare(a.productName, b.productName));
    } catch (error) {
      const message = describeError(error);
      if (!this.isActiveLoad(requestId)) return;
      this.error = message;
      this.toast.danger(message);
    } finally {
      if (this.isActiveLoad(requestId)) this.loading = false;
    }
  }

  asBrandRow(row: unknown): BrandRow {
    return row as BrandRow;
  }

  statusLabel(value: AuthBrandStatus): string {
    return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
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

  duplicateBrand(row: BrandRow): void {
    void this.router.navigate(["/authentication/brands/new"], {
      state: {
        duplicate: {
          ...structuredClone(row.definition),
          key: `${row.key}-copy`,
          displayName: `${row.definition.displayName} Copy`,
          productName: `${row.definition.productName} Copy`,
        } satisfies AuthBrandDefinition,
      },
    });
  }

  async archiveBrand(row: BrandRow): Promise<void> {
    if (!window.confirm(`Archive the ${row.productName} brand?`)) return;
    this.busyBrandId = row.id;
    try {
      await this.api.archiveAuthBrand(row.id);
      this.toast.success("Brand archived");
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    } finally {
      if (!this.destroyed) this.busyBrandId = "";
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

  private toRow(brand: AuthBrandRecord, clientCount: number): BrandRow {
    const productName = brand.definition.productName || brand.key;
    return {
      id: brand.id,
      key: brand.key,
      productName,
      primaryColor: brand.definition.primaryColor,
      status: brand.status,
      clientCount,
      version: brand.version,
      updatedAt: brand.updated_at,
      definition: brand.definition,
      searchText: [productName, brand.key, brand.status].join(" ").toLowerCase(),
    };
  }
}
