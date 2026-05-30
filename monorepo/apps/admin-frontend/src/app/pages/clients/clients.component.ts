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
  template: `
    <div class="toolbar">
      <div>
        <h1 class="page-title">OAuth Clients</h1>
        <p class="muted">{{ rows.length }} registered</p>
      </div>
      <tng-button appearance="outline" size="sm" tone="neutral" (click)="startCreate()">New client</tng-button>
    </div>

    @if (error) {
      <div class="alert alert-error">{{ error }}</div>
    }
    @if (notice) {
      <div class="alert alert-success">{{ notice }}</div>
    }

    <tng-table [columns]="columns" [items]="rows" [loading]="loading" ariaLabel="Hydra OAuth clients" density="comfortable">
      <ng-template tngTableCellTemplate="actions" let-row="row">
        <span class="row">
          <a class="cell-link" href="#" (click)="startEdit(row); $event.preventDefault()">Edit</a>
          <a class="cell-link" href="#" (click)="remove(idOf(row)); $event.preventDefault()">Delete</a>
        </span>
      </ng-template>
    </tng-table>

    <tng-card style="margin-top: 1.25rem;">
      <tng-card-header>
        <tng-card-title>{{ editing ? "Edit client" : "Create client" }}</tng-card-title>
      </tng-card-header>
      <tng-card-content>
        <div class="field-grid">
          <tng-form-field>
            <tng-label>Client ID</tng-label>
            <tng-input name="client_id" [(ngModel)]="form.client_id" [readonly]="editing" placeholder="daybook-user-client" />
          </tng-form-field>
          <tng-form-field>
            <tng-label>Client name</tng-label>
            <tng-input name="client_name" [(ngModel)]="form.client_name" placeholder="Dev Daybook User Client" />
          </tng-form-field>
          <tng-form-field class="full">
            <tng-label>Scope</tng-label>
            <tng-input name="scope" [(ngModel)]="form.scope" />
          </tng-form-field>
          <tng-form-field class="full">
            <tng-label>Redirect URIs (comma or newline separated)</tng-label>
            <tng-input name="redirect_uris" [(ngModel)]="form.redirectUris" placeholder="https://app/callback" />
          </tng-form-field>
          <tng-form-field class="full">
            <tng-label>Post-logout redirect URIs</tng-label>
            <tng-input name="post_logout" [(ngModel)]="form.postLogoutUris" placeholder="https://app/logout" />
          </tng-form-field>
          <tng-form-field class="full">
            <tng-label>Audience</tng-label>
            <tng-input name="audience" [(ngModel)]="form.audience" placeholder="daybook.cloud-users" />
          </tng-form-field>
        </div>

        <div class="row" style="margin-top: 0.75rem;">
          <tng-switch [(checked)]="form.public" ariaLabel="Public SPA client (PKCE)"></tng-switch>
          <span>Public SPA client — uses PKCE (<code>token_endpoint_auth_method=none</code>).</span>
        </div>

        <div class="row" style="margin-top: 1rem;">
          <tng-button appearance="solid" tone="primary" [disabled]="busy || !form.client_id" (click)="submit()">
            {{ editing ? "Save changes" : "Create client" }}
          </tng-button>
          @if (editing) {
            <tng-button appearance="outline" tone="neutral" [disabled]="busy" (click)="startCreate()">Cancel</tng-button>
          }
        </div>
      </tng-card-content>
    </tng-card>
  `,
})
export class ClientsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

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
      } else {
        await this.api.createClient(payload);
        this.notice = `Client "${payload.client_id}" created.`;
      }
      this.startCreate();
      await this.reload();
    } catch (e) {
      this.error = describeError(e);
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
      await this.reload();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }
}
