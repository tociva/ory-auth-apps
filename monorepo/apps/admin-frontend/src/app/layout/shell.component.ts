import { Component, inject, type OnInit } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { TngButtonComponent } from "@tailng-ui/components";
import { AdminApiService } from "../core/admin-api.service";
import { ADMIN_CONFIG } from "../core/admin-config";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TngButtonComponent],
  templateUrl: "./shell.component.html",
  styleUrls: ["./shell.component.css"],
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
    // Derive the auth app's logout page from its login URL, and pass return_to
    // so that after the Kratos session is cleared the browser lands back on the
    // admin app (which then bounces to login, since there's no session).
    const logoutUrl = this.config.authLoginUrl.replace(/\/login\/?$/, "/logout");
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `${logoutUrl}?return_to=${returnTo}`;
  }
}
