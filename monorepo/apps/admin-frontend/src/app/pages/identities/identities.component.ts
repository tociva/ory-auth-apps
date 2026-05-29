import { Component, inject, type OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  TngBadgeComponent,
  TngButtonComponent,
  TngTableCellTemplate,
  TngTableComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import {
  type AdminIdentity,
  identityEmail,
  identityName,
  isAdminRole,
} from "../../core/admin-types";

@Component({
  selector: "app-identities",
  standalone: true,
  imports: [RouterLink, TngTableComponent, TngTableCellTemplate, TngBadgeComponent, TngButtonComponent],
  template: `
    <div class="toolbar">
      <div>
        <h1 class="page-title">Identities</h1>
        <p class="muted">{{ rows.length }} loaded</p>
      </div>
      <tng-button appearance="outline" size="sm" tone="neutral" (click)="reload()">Refresh</tng-button>
    </div>

    @if (error) {
      <div class="alert alert-error">{{ error }}</div>
    }

    <tng-table
      [columns]="columns"
      [items]="rows"
      [loading]="loading"
      ariaLabel="Kratos identities"
      density="comfortable"
    >
      <ng-template tngTableCellTemplate="role" let-row="row">
        @if (roleOf(row)) {
          <span tngBadge>admin</span>
        } @else {
          <span class="muted">user</span>
        }
      </ng-template>
      <ng-template tngTableCellTemplate="actions" let-row="row">
        <a class="cell-link" [routerLink]="['/identities', idOf(row)]">Manage</a>
      </ng-template>
    </tng-table>
  `,
})
export class IdentitiesComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  rows: AdminIdentity[] = [];
  loading = true;
  error = "";

  readonly columns: TngTableColumn<AdminIdentity>[] = [
    { id: "name", label: "Name", accessor: (row) => identityName(row) },
    { id: "email", label: "Email", accessor: (row) => identityEmail(row) },
    { id: "state", label: "State", accessor: (row) => row.state ?? "active" },
    { id: "role", label: "Role" },
    { id: "actions", label: "", align: "end" },
  ];

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.rows = await this.api.listIdentities();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.loading = false;
    }
  }

  // Cell-template context rows are typed `unknown`; narrow here so the template
  // stays type-safe under strictTemplates.
  idOf(row: unknown): string {
    return (row as AdminIdentity).id;
  }

  roleOf(row: unknown): boolean {
    return isAdminRole(row as AdminIdentity);
  }
}
