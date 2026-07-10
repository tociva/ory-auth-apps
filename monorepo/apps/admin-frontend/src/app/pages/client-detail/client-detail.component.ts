import { Component, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngFormFieldComponent,
  TngInputComponent,
  TngLabelComponent,
  TngProgressSpinnerComponent,
  TngSwitchComponent,
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
  selector: "app-client-detail",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngFormFieldComponent,
    TngInputComponent,
    TngLabelComponent,
    TngProgressSpinnerComponent,
    TngSwitchComponent,
  ],
  templateUrl: "./client-detail.component.html",
  styleUrls: ["./client-detail.component.css"],
})
export class ClientDetailComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  createMode = true;
  loading = true;
  busy = false;
  error = "";
  notice = "";
  form: ClientForm = emptyForm();

  private clientId = "";

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get("clientId") ?? "";
    this.createMode = !this.clientId;
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      if (this.createMode) {
        this.form = emptyForm();
      } else {
        this.applyClient(await this.api.getClient(this.clientId));
      }
    } catch (e) {
      this.error = describeError(e);
      this.toast.danger(this.error);
    } finally {
      this.loading = false;
    }
  }

  private applyClient(client: HydraClient): void {
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
    await this.run(async () => {
      const payload = this.toPayload();
      if (this.createMode) {
        const created = await this.api.createClient(payload);
        this.toast.success(`Client "${payload.client_id}" created.`);
        await this.router.navigate(["/clients", created.client_id || payload.client_id]);
      } else {
        const updated = await this.api.updateClient(payload);
        this.applyClient(updated);
        this.notice = `Client "${payload.client_id}" updated.`;
        this.toast.success(this.notice);
      }
    });
  }

  async remove(): Promise<void> {
    const clientId = this.form.client_id.trim();
    if (!clientId || !window.confirm(`Delete client "${clientId}"?`)) return;
    await this.run(async () => {
      await this.api.deleteClient(clientId);
      this.toast.success(`Client "${clientId}" deleted.`);
      await this.router.navigate(["/clients"]);
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.error = "";
    this.notice = "";
    try {
      await fn();
    } catch (e) {
      this.error = describeError(e);
      this.toast.danger(this.error);
    } finally {
      this.busy = false;
    }
  }
}
