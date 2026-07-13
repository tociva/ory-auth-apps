import { Component, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  TngInputAngularFormsAdapter,
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
import {
  IDNEST_ADMIN_CLIENT_ID,
  type ClientAccessGrant,
  type ClientFormValue,
  type HydraClient,
} from "../../core/admin-types";
import { ToastService } from "../../core/toast/toast.service";

interface ClientForm {
  client_id: string;
  client_name: string;
  client_uri: string;
  logo_uri: string;
  policy_uri: string;
  tos_uri: string;
  contacts: string;
  trust_tier: "first_party" | "partner" | "third_party";
  consent_version: number | string;
  remember_offline_access: boolean;
  public: boolean;
  scope: string;
  redirectUris: string;
  postLogoutUris: string;
  audience: string;
}

const emptyForm = (): ClientForm => ({
  client_id: "",
  client_name: "",
  client_uri: "",
  logo_uri: "",
  policy_uri: "",
  tos_uri: "",
  contacts: "",
  trust_tier: "first_party",
  consent_version: 1,
  remember_offline_access: false,
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
    TngInputAngularFormsAdapter,
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
  identityGrants: ClientAccessGrant[] = [];

  private clientId = "";

  get protectedAdminClient(): boolean {
    return !this.createMode && this.form.client_id.trim() === IDNEST_ADMIN_CLIENT_ID;
  }

  get rememberOfflineAccessDisabled(): boolean {
    return this.protectedAdminClient || this.form.trust_tier !== "first_party";
  }

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
        await this.loadIdentityGrants();
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
      client_uri: client.client_uri ?? "",
      logo_uri: client.logo_uri ?? "",
      policy_uri: client.policy_uri ?? "",
      tos_uri: client.tos_uri ?? "",
      contacts: (client.contacts ?? []).join(", "),
      trust_tier: client.metadata?.trust_tier ?? "first_party",
      consent_version: client.metadata?.consent_version ?? 1,
      remember_offline_access: client.metadata?.remember_offline_access === true,
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
      client_uri: this.form.client_uri.trim(),
      logo_uri: this.form.logo_uri.trim(),
      policy_uri: this.form.policy_uri.trim(),
      tos_uri: this.form.tos_uri.trim(),
      contacts: splitList(this.form.contacts),
      metadata: {
        trust_tier: this.form.trust_tier,
        consent_version: Number(this.form.consent_version) || 1,
        remember_offline_access: this.form.trust_tier === "first_party" && this.form.remember_offline_access,
      },
      public: this.form.public,
      scope: this.form.scope.trim(),
      redirect_uris: splitList(this.form.redirectUris),
      post_logout_redirect_uris: splitList(this.form.postLogoutUris),
      audience: splitList(this.form.audience),
    };
  }

  onTrustTierChange(): void {
    if (this.form.trust_tier !== "first_party") {
      this.form.remember_offline_access = false;
    }
  }

  async submit(): Promise<void> {
    if (this.protectedAdminClient) {
      this.error = "The admin OAuth client cannot be edited.";
      this.toast.danger(this.error);
      return;
    }
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

  private async loadIdentityGrants(): Promise<void> {
    try {
      this.identityGrants = await this.api.listClientIdentityAccess(this.clientId);
    } catch {
      this.identityGrants = [];
    }
  }

  async revokeIdentity(identityId: string): Promise<void> {
    await this.run(async () => {
      await this.api.revokeIdentityClientAccess(identityId, this.clientId);
      await this.loadIdentityGrants();
      this.notice = "Client access revoked.";
      this.toast.success(this.notice);
    });
  }

  async remove(): Promise<void> {
    const clientId = this.form.client_id.trim();
    if (this.protectedAdminClient) {
      this.error = "The admin OAuth client cannot be deleted.";
      this.toast.danger(this.error);
      return;
    }
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
