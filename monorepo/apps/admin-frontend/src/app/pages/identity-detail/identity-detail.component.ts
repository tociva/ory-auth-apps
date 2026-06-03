import { Component, inject, type OnInit } from "@angular/core";
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
  type AdminIdentity,
  identityEmail,
  identityName,
  isAdminRole,
  isEmailVerified,
  type KratosSession,
} from "../../core/admin-types";

@Component({
  selector: "app-identity-detail",
  standalone: true,
  imports: [
    RouterLink,
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
    return this.identity ? isAdminRole(this.identity) : false;
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
      await this.loadSessions();
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

  async onToggleRole(next: boolean): Promise<void> {
    await this.run(async () => {
      this.identity = await this.api.setAdminRole(this.id, next);
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
