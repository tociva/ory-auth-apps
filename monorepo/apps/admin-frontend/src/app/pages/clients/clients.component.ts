import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  TngButtonComponent,
  TngTableCellTemplate,
  TngTableComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import type { HydraClient } from "../../core/admin-types";
import { ToastService } from "../../core/toast/toast.service";

@Component({
  selector: "app-clients",
  standalone: true,
  imports: [RouterLink, TngButtonComponent, TngTableCellTemplate, TngTableComponent],
  templateUrl: "./clients.component.html",
  styleUrls: ["./clients.component.css"],
})
export class ClientsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private destroyed = false;
  private loadRequestId = 0;

  rows: HydraClient[] = [];
  loading = true;
  error = "";

  readonly columns: TngTableColumn<HydraClient>[] = [
    { id: "client_id", label: "Client ID", accessor: (row) => row.client_id },
    { id: "client_name", label: "Name", accessor: (row) => row.client_name ?? "" },
    {
      id: "auth_method",
      label: "Auth method",
      accessor: (row) => row.token_endpoint_auth_method ?? "",
    },
    { id: "actions", label: "", align: "end" },
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
      const rows = await this.api.listClients();
      if (!(await this.canApplyLoadResult(requestId))) return;
      this.rows = rows;
    } catch (e) {
      const error = describeError(e);
      if (!(await this.canApplyLoadResult(requestId))) return;
      this.error = error;
      this.toast.danger(error);
    } finally {
      if (this.isActiveLoad(requestId)) {
        this.loading = false;
      }
    }
  }

  idOf(row: unknown): string {
    return (row as HydraClient).client_id;
  }

  private async canApplyLoadResult(requestId: number): Promise<boolean> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return this.isActiveLoad(requestId);
  }

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }
}
