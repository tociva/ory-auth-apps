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
  template: `
    <p><a class="cell-link" routerLink="/identities">&larr; Back to identities</a></p>

    @if (loading) {
      <div class="row"><tng-progress-spinner /> <span class="muted">Loading…</span></div>
    } @else if (!identity) {
      <div class="alert alert-error">{{ error || "Identity not found." }}</div>
    } @else {
      @if (error) {
        <div class="alert alert-error">{{ error }}</div>
      }
      @if (notice) {
        <div class="alert alert-success">{{ notice }}</div>
      }

      <div class="stack">
        <tng-card>
          <tng-card-header>
            <tng-card-title>{{ name }}</tng-card-title>
          </tng-card-header>
          <tng-card-content>
            <div class="row">
              <span class="muted">Email</span>
              <span>{{ email || "—" }}</span>
              @if (verified) {
                <span tngBadge>verified</span>
              } @else {
                <span class="muted">unverified</span>
              }
            </div>
            <tng-separator />
            <div class="row"><span class="muted">State</span><span>{{ identity.state ?? "active" }}</span></div>
            <div class="row"><span class="muted">ID</span><span class="muted">{{ identity.id }}</span></div>
          </tng-card-content>
        </tng-card>

        <tng-card>
          <tng-card-header>
            <tng-card-title>Admin role</tng-card-title>
          </tng-card-header>
          <tng-card-content>
            <div class="row">
              <tng-switch
                [checked]="admin"
                [disabled]="busy"
                ariaLabel="Toggle admin role"
                (checkedChange)="onToggleRole($event)"
              ></tng-switch>
              <span>{{ admin ? "This user is an administrator." : "Standard user." }}</span>
            </div>
            <p class="muted">
              Backed by Kratos <code>metadata_admin.role</code> — the runtime source of truth.
            </p>
          </tng-card-content>
        </tng-card>

        <tng-card>
          <tng-card-header>
            <tng-card-title>Sessions</tng-card-title>
          </tng-card-header>
          <tng-card-content>
            <div class="toolbar">
              <span class="muted">{{ sessions.length }} active</span>
              <tng-button size="sm" appearance="outline" tone="danger" [disabled]="busy || !sessions.length" (click)="revokeAll()">
                Revoke all
              </tng-button>
            </div>
            @for (s of sessions; track s.id) {
              <div class="row" style="justify-content: space-between; padding: 0.4rem 0;">
                <div>
                  <div class="muted">{{ s.id }}</div>
                  <div class="muted">expires: {{ s.expires_at || "—" }}</div>
                </div>
                <tng-button size="sm" appearance="outline" tone="danger" [disabled]="busy" (click)="revokeOne(s.id)">
                  Revoke
                </tng-button>
              </div>
            } @empty {
              <p class="muted">No active sessions.</p>
            }
          </tng-card-content>
        </tng-card>

        <tng-card>
          <tng-card-header>
            <tng-card-title>Danger zone</tng-card-title>
          </tng-card-header>
          <tng-card-content>
            <div class="row">
              <tng-button appearance="outline" tone="neutral" [disabled]="busy" (click)="deactivate()">
                Deactivate
              </tng-button>
              <tng-button appearance="solid" tone="danger" [disabled]="busy" (click)="remove()">
                Delete identity
              </tng-button>
            </div>
          </tng-card-content>
        </tng-card>
      </div>
    }
  `,
})
export class IdentityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AdminApiService);

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
    });
  }

  async deactivate(): Promise<void> {
    await this.run(async () => {
      this.identity = await this.api.deactivateIdentity(this.id);
      this.notice = "Identity deactivated.";
    });
  }

  async remove(): Promise<void> {
    if (!window.confirm("Permanently delete this identity? This cannot be undone.")) return;
    await this.run(async () => {
      await this.api.deleteIdentity(this.id);
      await this.router.navigate(["/identities"]);
    });
  }

  async revokeOne(sessionId: string): Promise<void> {
    await this.run(async () => {
      await this.api.revokeSession(sessionId);
      await this.loadSessions();
      this.notice = "Session revoked.";
    });
  }

  async revokeAll(): Promise<void> {
    await this.run(async () => {
      await this.api.revokeIdentitySessions(this.id);
      await this.loadSessions();
      this.notice = "All sessions revoked.";
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
    } finally {
      this.busy = false;
    }
  }
}
