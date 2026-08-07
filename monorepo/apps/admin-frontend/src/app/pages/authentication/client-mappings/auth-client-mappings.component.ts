import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import type { AuthClientConfigStatus, ConsentMode } from "@idnest/shared-types";
import {
  TngBadgeComponent,
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardDescriptionComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngFormFieldComponent,
  TngInputAngularFormsAdapter,
  TngInputComponent,
  TngLabelComponent,
  TngTableCellTemplate,
  TngTableComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { AdminApiService, describeError } from "../../../core/admin-api.service";
import type {
  AuthBrandRecord,
  AuthPolicyRecord,
  HydraClient,
  OAuthClientAuthConfigRecord,
} from "../../../core/admin-types";
import { ToastService } from "../../../core/toast/toast.service";
import {
  CONSENT_MODE_OPTIONS,
  MAPPING_STATUS_OPTIONS,
} from "../authentication-page.types";

interface MappingRow {
  clientId: string;
  clientName: string;
  brandLabel: string;
  brandMeta: string;
  policyLabel: string;
  policyMeta: string;
  status: AuthClientConfigStatus;
  consentMode: ConsentMode;
  isFirstParty: boolean;
  version: number;
  updatedAt: string;
  searchText: string;
}

@Component({
  selector: "app-auth-client-mappings",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TngBadgeComponent,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardDescriptionComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngFormFieldComponent,
    TngInputAngularFormsAdapter,
    TngInputComponent,
    TngLabelComponent,
    TngIcon,
    TngTableCellTemplate,
    TngTableComponent,
  ],
  templateUrl: "./auth-client-mappings.component.html",
  styleUrls: ["../authentication-page.css"],
})
export class AuthClientMappingsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  private readonly rowSorter = new Intl.Collator(undefined, { sensitivity: "base" });
  private destroyed = false;
  private loadRequestId = 0;

  rows: MappingRow[] = [];
  loading = true;
  error = "";
  mappingSearch = "";
  busyClientId = "";

  readonly columns: TngTableColumn<MappingRow>[] = [
    { id: "client", label: "OAuth client", accessor: (row) => row.clientId, width: "18rem" },
    { id: "brand", label: "Brand", accessor: (row) => row.brandLabel, width: "15rem" },
    { id: "policy", label: "Login policy", accessor: (row) => row.policyLabel, width: "15rem" },
    { id: "consent", label: "Consent", accessor: (row) => this.consentModeLabel(row.consentMode) },
    { id: "trust", label: "Trust", accessor: (row) => (row.isFirstParty ? "First party" : "External") },
    { id: "status", label: "Status", accessor: (row) => this.statusLabel(row.status) },
    {
      id: "updated",
      label: "Updated",
      accessor: (row) => this.dateLabel(row.updatedAt),
      width: "12rem",
    },
    { id: "actions", label: "", align: "end", width: "11rem" },
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
      const [brands, policies, clients, mappings] = await Promise.all([
        this.api.listAuthBrands(),
        this.api.listAuthPolicies(),
        this.api.listClients(),
        this.api.listClientAuthConfigs(),
      ]);
      if (!this.isActiveLoad(requestId)) return;
      this.rows = this.toRows(mappings, clients, brands, policies);
    } catch (error) {
      const message = describeError(error);
      if (!this.isActiveLoad(requestId)) return;
      this.error = message;
      this.toast.danger(message);
    } finally {
      if (this.isActiveLoad(requestId)) this.loading = false;
    }
  }

  visibleRows(): MappingRow[] {
    const search = this.mappingSearch.trim().toLowerCase();
    return search ? this.rows.filter((row) => row.searchText.includes(search)) : this.rows;
  }

  asMappingRow(row: unknown): MappingRow {
    return row as MappingRow;
  }

  statusLabel(value: AuthClientConfigStatus): string {
    return MAPPING_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  consentModeLabel(value: ConsentMode): string {
    return CONSENT_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  dateLabel(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : this.dateFormatter.format(date);
  }

  async archiveMapping(row: MappingRow): Promise<void> {
    if (!window.confirm(`Delete the authentication mapping for ${row.clientId}?`)) return;
    this.busyClientId = row.clientId;
    try {
      await this.api.archiveClientAuthConfig(row.clientId);
      this.toast.success("Client authentication mapping deleted");
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    } finally {
      if (!this.destroyed) this.busyClientId = "";
    }
  }

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }

  private toRows(
    mappings: OAuthClientAuthConfigRecord[],
    clients: HydraClient[],
    brands: AuthBrandRecord[],
    policies: AuthPolicyRecord[],
  ): MappingRow[] {
    const clientsById = new Map(clients.map((client) => [client.client_id, client]));
    const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
    const policiesById = new Map(policies.map((policy) => [policy.id, policy]));

    return mappings
      .map((mapping) => {
        const client = clientsById.get(mapping.hydra_client_id);
        const brand = brandsById.get(mapping.brand_id);
        const policy = policiesById.get(mapping.authentication_policy_id);
        const clientName = client?.client_name?.trim() ?? "";
        const brandLabel = brand?.definition.productName || mapping.brand_key || mapping.brand_id;
        const brandMeta = brand?.key || mapping.brand_key || mapping.brand_id;
        const policyLabel =
          policy?.definition.name ||
          mapping.authentication_policy_name ||
          mapping.authentication_policy_id;
        const policyMeta = policy?.status
          ? `${policy.status} policy`
          : mapping.authentication_policy_name;
        const statusLabel = this.statusLabel(mapping.status);
        const consentLabel = this.consentModeLabel(mapping.consent_mode);

        return {
          clientId: mapping.hydra_client_id,
          clientName,
          brandLabel,
          brandMeta,
          policyLabel,
          policyMeta,
          status: mapping.status,
          consentMode: mapping.consent_mode,
          isFirstParty: mapping.is_first_party,
          version: mapping.version,
          updatedAt: mapping.updated_at,
          searchText: [
            mapping.hydra_client_id,
            clientName,
            brandLabel,
            brandMeta,
            policyLabel,
            policyMeta,
            statusLabel,
            consentLabel,
          ]
            .join(" ")
            .toLowerCase(),
        };
      })
      .sort((a, b) => this.rowSorter.compare(a.clientId, b.clientId));
  }
}
