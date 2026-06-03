import { Component, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngFormFieldComponent,
  TngInputComponent,
  TngLabelComponent,
  TngSwitchComponent,
  TngTableCellTemplate,
  TngTableComponent,
  type TngTableColumn,
} from "@tailng-ui/components";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import type { ClientFormValue, HydraClient } from "../../core/admin-types";
import { ToastService } from "../../core/toast/toast.service";

interface ClientForm {
  client_id: string;
  client_name: string;
  public: boolean;
  scope: string;
  redirectUris: string;
  postLogoutUris: string;
  audience: string;
}

const emptyForm = (): ClientForm => ({
  client_id: "",
  client_name: "",
  public: true,
  scope: "openid profile email offline_access",
  redirectUris: "",
  postLogoutUris: "",
  audience: "",
});

const splitList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

@Component({
  selector: "app-clients",
  standalone: true,
  imports: [
    FormsModule,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngFormFieldComponent,
    TngInputComponent,
    TngLabelComponent,
    TngSwitchComponent,
    TngTableCellTemplate,
    TngTableComponent,
  ],
  templateUrl: "./clients.component.html",
  styleUrls: ["./clients.component.css"],
})
export class ClientsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  rows: HydraClient[] = [];
  loading = true;
  busy = false;
  editing = false;
  error = "";
  notice = "";
  form: ClientForm = emptyForm();

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

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.rows = await this.api.listClients();
    } catch (e) {
      this.error = describeError(e);
      this.toast.danger(this.error);
    } finally {
      this.loading = false;
    }
  }

  idOf(row: unknown): string {
    return (row as HydraClient).client_id;
  }

  startCreate(): void {
    this.editing = false;
    this.form = emptyForm();
    this.notice = "";
    this.error = "";
  }

  startEdit(row: unknown): void {
    const client = row as HydraClient;
    this.editing = true;
    this.notice = "";
    this.error = "";
    this.form = {
      client_id: client.client_id,
      client_name: client.client_name ?? "",
      public: client.token_endpoint_auth_method === "none",
      scope: client.scope ?? "",
      redirectUris: (client.redirect_uris ?? []).join(", "),
      postLogoutUris: (client.post_logout_redirect_uris ?? []).join(", "),
      audience: (client.audience ?? []).join(", "),
    };
  }

  private toPayload(): ClientFormValue {
    return {
      client_id: this.form.client_id.trim(),
      client_name: this.form.client_name.trim(),
      public: this.form.public,
      scope: this.form.scope.trim(),
      redirect_uris: splitList(this.form.redirectUris),
      post_logout_redirect_uris: splitList(this.form.postLogoutUris),
      audience: splitList(this.form.audience),
    };
  }

  async submit(): Promise<void> {
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      const payload = this.toPayload();
      if (this.editing) {
        await this.api.updateClient(payload);
        this.notice = `Client "${payload.client_id}" updated.`;
        this.toast.success(this.notice);
      } else {
        await this.api.createClient(payload);
        this.notice = `Client "${payload.client_id}" created.`;
        this.toast.success(this.notice);
      }
      this.startCreate();
      await this.reload();
    } catch (e) {
      this.error = describeError(e);
      this.toast.danger(this.error);
    } finally {
      this.busy = false;
    }
  }

  async remove(clientId: string): Promise<void> {
    if (!window.confirm(`Delete client "${clientId}"?`)) return;
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await this.api.deleteClient(clientId);
      this.notice = `Client "${clientId}" deleted.`;
      this.toast.success(this.notice);
      await this.reload();
    } catch (e) {
      this.error = describeError(e);
      this.toast.danger(this.error);
    } finally {
      this.busy = false;
    }
  }
}
