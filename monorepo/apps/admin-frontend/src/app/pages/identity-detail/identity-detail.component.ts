import { Component, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  TngBadgeComponent,
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngProgressSpinnerComponent,
  TngSeparatorComponent,
  TngSwitchComponent,
} from "@tailng-ui/components";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import { ToastService } from "../../core/toast/toast.service";
import {
  IDNEST_ADMIN_CLIENT_ID,
  type AdminIdentity,
  type ClientAccessGrant,
  type HydraClient,
  identityEmail,
  identityName,
  isEmailVerified,
  type KratosSession,
} from "../../core/admin-types";

@Component({
  selector: "app-identity-detail",
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    TngBadgeComponent,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngProgressSpinnerComponent,
    TngSeparatorComponent,
    TngSwitchComponent,
  ],
  templateUrl: "./identity-detail.component.html",
  styleUrls: ["./identity-detail.component.css"],
})
export class IdentityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  identity: AdminIdentity | null = null;
  sessions: KratosSession[] = [];
  clientGrants: ClientAccessGrant[] = [];
  clients: HydraClient[] = [];
  selectedClientId = "";
  loading = true;
  busy = false;
  error = "";
  notice = "";

  private id = "";

  get name(): string {
    return this.identity ? identityName(this.identity) : "";
  }
  get email(): string {
    return this.identity ? identityEmail(this.identity) : "";
  }
  get verified(): boolean {
    return this.identity ? isEmailVerified(this.identity) : false;
  }
  get admin(): boolean {
    return this.hasClientGrant(IDNEST_ADMIN_CLIENT_ID);
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get("id") ?? "";
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      this.identity = await this.api.getIdentity(this.id);
      await Promise.all([this.loadSessions(), this.loadClientAccess()]);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.loading = false;
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      this.sessions = await this.api.listIdentitySessions(this.id);
    } catch {
      this.sessions = [];
    }
  }

  private async loadClientAccess(): Promise<void> {
    try {
      const [grants, clients] = await Promise.all([
        this.api.listIdentityClientAccess(this.id),
        this.api.listClients(),
      ]);
      this.clientGrants = grants;
      this.clients = clients;
      this.selectedClientId = this.clients.find((client) => !this.hasClientGrant(client.client_id))?.client_id ?? "";
    } catch {
      this.clientGrants = [];
      this.clients = [];
      this.selectedClientId = "";
    }
  }

  hasClientGrant(clientId: string): boolean {
    return this.clientGrants.some((grant) => grant.client_id === clientId);
  }

  async onToggleRole(next: boolean): Promise<void> {
    await this.run(async () => {
      if (next) {
        await this.api.grantIdentityClientAccess(this.id, IDNEST_ADMIN_CLIENT_ID, "system-admin");
      } else {
        await this.api.revokeIdentityClientAccess(this.id, IDNEST_ADMIN_CLIENT_ID);
      }
      await this.loadClientAccess();
      this.notice = next ? "Admin role granted." : "Admin role revoked.";
      this.toast.success(this.notice);
    });
  }

  async deactivate(): Promise<void> {
    await this.run(async () => {
      this.identity = await this.api.deactivateIdentity(this.id);
      this.notice = "Identity deactivated.";
      this.toast.success(this.notice);
    });
  }

  async remove(): Promise<void> {
    if (!window.confirm("Permanently delete this identity? This cannot be undone.")) return;
    await this.run(async () => {
      await this.api.deleteIdentity(this.id);
      this.toast.success("Identity deleted.");
      await this.router.navigate(["/identities"]);
    });
  }

  async revokeOne(sessionId: string): Promise<void> {
    await this.run(async () => {
      await this.api.revokeSession(sessionId);
      await this.loadSessions();
      this.notice = "Session revoked.";
      this.toast.success(this.notice);
    });
  }

  async revokeAll(): Promise<void> {
    await this.run(async () => {
      await this.api.revokeIdentitySessions(this.id);
      await this.loadSessions();
      this.notice = "All sessions revoked.";
      this.toast.success(this.notice);
    });
  }

  async grantClientAccess(): Promise<void> {
    const clientId = this.selectedClientId.trim();
    if (!clientId) return;
    await this.run(async () => {
      await this.api.grantIdentityClientAccess(this.id, clientId);
      await this.loadClientAccess();
      this.notice = `Access granted to ${clientId}.`;
      this.toast.success(this.notice);
    });
  }

  async revokeClientAccess(clientId: string): Promise<void> {
    await this.run(async () => {
      await this.api.revokeIdentityClientAccess(this.id, clientId);
      await this.loadClientAccess();
      this.notice = `Access revoked from ${clientId}.`;
      this.toast.success(this.notice);
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
