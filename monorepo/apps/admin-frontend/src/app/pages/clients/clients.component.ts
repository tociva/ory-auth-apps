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
import type { HydraClient } from "../../core/admin-types";
import {
  LIST_PAGE_SIZE_OPTIONS,
  clampListPage,
  matchesListSearch,
  paginateItems,
  parseListPageQuery,
  toListPageQueryParams,
  type ListPageQuery,
} from "../../core/list-page-query";
import { getOAuthClientTypeLabel, inferOAuthClientType } from "../../core/oauth-client-profiles";
import { ToastService } from "../../core/toast/toast.service";

interface ClientRow {
  client: HydraClient;
  searchText: string;
}

@Component({
  selector: "app-clients",
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
  templateUrl: "./clients.component.html",
  styleUrls: ["./clients.component.css"],
})
export class ClientsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly clientSorter = new Intl.Collator(undefined, { sensitivity: "base" });
  private destroyed = false;
  private loadRequestId = 0;

  private readonly filterPopover = viewChild<TngPopover>("filterPopover");

  rows: ClientRow[] = [];
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

  readonly columns: TngTableColumn<ClientRow>[] = [
    {
      id: "client",
      label: "Client",
      accessor: (row) => row.client.client_id,
      width: "18rem",
    },
    {
      id: "type",
      label: "Type",
      accessor: (row) => this.clientTypeLabel(row.client),
    },
    {
      id: "authMethod",
      label: "Auth method",
      accessor: (row) => this.authMethodLabel(row.client),
    },
    {
      id: "redirectUris",
      label: "Redirect URIs",
      accessor: (row) => this.redirectUriSummary(row.client),
      width: "16rem",
    },
    {
      id: "scopes",
      label: "Scopes",
      accessor: (row) => this.scopeSummary(row.client),
      width: "14rem",
    },
    { id: "actions", label: "", align: "end", width: "3.5rem" },
  ];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.query = parseListPageQuery(params);
      this.filterQ = this.query.q;
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  get filteredRows(): ClientRow[] {
    return this.rows.filter((row) => matchesListSearch(row.searchText, this.query.q));
  }

  get filteredTotal(): number {
    return this.filteredRows.length;
  }

  get pageIndex(): number {
    return this.clampedPage - 1;
  }

  get pagedRows(): ClientRow[] {
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
      const rows = await this.api.listClients();
      if (!this.isActiveLoad(requestId)) return;
      this.rows = this.sortClients(rows).map((client) => this.toRow(client));
    } catch (e) {
      const error = describeError(e);
      if (!this.isActiveLoad(requestId)) return;
      this.error = error;
      this.toast.danger(error);
    } finally {
      if (this.isActiveLoad(requestId)) {
        this.loading = false;
      }
    }
  }

  asClientRow(row: unknown): ClientRow {
    return row as ClientRow;
  }

  authMethodLabel(client: HydraClient): string {
    switch (client.token_endpoint_auth_method) {
      case "none":
        return "Public (PKCE)";
      case "client_secret_basic":
        return "Secret basic";
      case "client_secret_post":
        return "Secret post";
      case "private_key_jwt":
        return "Private key JWT";
      default:
        return client.token_endpoint_auth_method?.trim() || "Not set";
    }
  }

  clientTypeLabel(client: HydraClient): string {
    return getOAuthClientTypeLabel(inferOAuthClientType(client));
  }

  redirectUriSummary(client: HydraClient): string {
    const redirectUris = client.redirect_uris ?? [];
    if (redirectUris.length === 0) return "No redirect URIs";
    if (redirectUris.length === 1) return redirectUris[0] ?? "";
    return `${redirectUris.length} redirect URIs`;
  }

  redirectUriTitle(client: HydraClient): string | null {
    const redirectUris = client.redirect_uris ?? [];
    return redirectUris.length > 0 ? redirectUris.join("\n") : null;
  }

  scopeSummary(client: HydraClient): string {
    return client.scope?.trim() || "No scopes";
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

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }

  private sortClients(rows: HydraClient[]): HydraClient[] {
    return [...rows].sort((a, b) => this.clientSorter.compare(a.client_id, b.client_id));
  }

  private toRow(client: HydraClient): ClientRow {
    return {
      client,
      searchText: [
        client.client_id,
        client.client_name ?? "",
        this.clientTypeLabel(client),
        this.authMethodLabel(client),
        this.redirectUriSummary(client),
        this.scopeSummary(client),
      ]
        .join(" ")
        .toLowerCase(),
    };
  }
}
