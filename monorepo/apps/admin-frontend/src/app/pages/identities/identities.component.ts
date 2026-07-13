import { Component, inject, type OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  TngButtonComponent,
  TngTableCellTemplate,
  TngTableComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import { ToastService } from "../../core/toast/toast.service";
import {
  type AdminIdentity,
  identityEmail,
  identityName,
} from "../../core/admin-types";

@Component({
  selector: "app-identities",
  standalone: true,
  imports: [RouterLink, TngTableComponent, TngTableCellTemplate, TngButtonComponent],
  templateUrl: "./identities.component.html",
  styleUrls: ["./identities.component.css"],
})
export class IdentitiesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  rows: AdminIdentity[] = [];
  loading = true;
  error = "";

  readonly columns: TngTableColumn<AdminIdentity>[] = [
    { id: "name", label: "Name", accessor: (row) => identityName(row) },
    { id: "email", label: "Email", accessor: (row) => identityEmail(row) },
    { id: "state", label: "State", accessor: (row) => row.state ?? "active" },
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
      this.toast.danger(this.error);
    } finally {
      this.loading = false;
    }
  }

  // Cell-template context rows are typed `unknown`; narrow here so the template
  // stays type-safe under strictTemplates.
  idOf(row: unknown): string {
    return (row as AdminIdentity).id;
  }

}
