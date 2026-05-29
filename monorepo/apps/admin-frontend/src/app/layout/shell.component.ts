import { Component, inject, type OnInit } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { TngButtonComponent } from "@tailng-ui/components";
import { AdminApiService } from "../core/admin-api.service";
import { ADMIN_CONFIG } from "../core/admin-config";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TngButtonComponent],
  template: `
    <div class="admin-shell">
      <header class="admin-header">
        <div class="row">
          <span class="admin-brand">Daybook Admin</span>
          <nav class="admin-nav">
            <a routerLink="/identities" routerLinkActive="active">Identities</a>
            <a routerLink="/clients" routerLinkActive="active">OAuth Clients</a>
          </nav>
        </div>
        <div class="admin-user">
          @if (email) {
            <span>{{ email }}</span>
          }
          <tng-button appearance="outline" size="sm" tone="neutral" (click)="signOut()">
            Sign out
          </tng-button>
        </div>
      </header>
      <main class="admin-main">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly config = inject(ADMIN_CONFIG);

  email = "";

  async ngOnInit(): Promise<void> {
    try {
      const me = await this.api.me();
      this.email = me.email;
    } catch {
      // The guard already gated entry; ignore a transient failure here.
    }
  }

  signOut(): void {
    // Derive the auth app's logout page from its login URL.
    window.location.href = this.config.authLoginUrl.replace(/\/login\/?$/, "/logout");
  }
}
