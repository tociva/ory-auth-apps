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
  templateUrl: "./identities.component.html",
  styleUrls: ["./identities.component.css"],
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
