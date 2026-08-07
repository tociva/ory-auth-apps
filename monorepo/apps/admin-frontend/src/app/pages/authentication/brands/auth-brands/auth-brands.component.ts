import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import type { AuthBrandDefinition, AuthBrandStatus } from "@idnest/shared-types";
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
import type { AuthBrandRecord } from "../../../../core/admin-types";
import { ToastService } from "../../../../core/toast/toast.service";
import { STATUS_OPTIONS } from "../../authentication-page.types";

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
}

@Component({
  selector: "app-auth-brands",
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
  templateUrl: "./auth-brands.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthBrandsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  private readonly rowSorter = new Intl.Collator(undefined, { sensitivity: "base" });
  private destroyed = false;
  private loadRequestId = 0;

  rows: BrandRow[] = [];
  loading = true;
  error = "";
  busyBrandId = "";

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

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }

  private toRow(brand: AuthBrandRecord, clientCount: number): BrandRow {
    return {
      id: brand.id,
      key: brand.key,
      productName: brand.definition.productName || brand.key,
      primaryColor: brand.definition.primaryColor,
      status: brand.status,
      clientCount,
      version: brand.version,
      updatedAt: brand.updated_at,
      definition: brand.definition,
    };
  }
}
