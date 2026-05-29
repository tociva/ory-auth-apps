import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  TngCardActionsComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngProgressSpinnerComponent,
} from "@tailng-ui/components";
import { AuthApiService } from "../../core/auth-api.service";
import { KratosService } from "../../core/kratos.service";

@Component({
  selector: "app-logout",
  standalone: true,
  imports: [TngCardComponent, TngCardContentComponent, TngCardActionsComponent, TngProgressSpinnerComponent],
  templateUrl: "./logout.component.html",
  styleUrl: "./logout.component.css",
})
export class LogoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly kratos = inject(KratosService);
  private readonly api = inject(AuthApiService);

  loading = true;
  error = "";

  async ngOnInit(): Promise<void> {
    const logoutChallenge = this.route.snapshot.queryParamMap.get("logout_challenge");
    if (!logoutChallenge) {
      this.error = "Missing logout_challenge";
      this.loading = false;
      return;
    }

    try {
      // Terminate the Kratos identity session first. Initiating the browser
      // logout flow only returns { logout_token, logout_url }; we must then
      // follow logout_url to actually destroy the session, otherwise the user
      // is silently signed back in on the next OAuth flow. A 401 here means
      // there is no active session - nothing to terminate, so we continue.
      try {
        const init = await this.kratos.initLogout();
        const performUrl =
          init.logout_url ?? (init.logout_token ? this.kratos.logoutTokenUrl(init.logout_token) : null);
        if (performUrl) {
          await this.kratos.performLogout(performUrl).catch(() => undefined);
        }
      } catch {
        // No active Kratos session (401) or init failed; proceed to Hydra.
      }

      const { redirect_to } = await this.api.acceptLogout(logoutChallenge);
      if (redirect_to) {
        window.location.replace(redirect_to);
      } else {
        this.error = "No redirect URL from Hydra";
        this.loading = false;
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Logout failed";
      this.loading = false;
    }
  }

  reload(): void {
    window.location.reload();
  }
}
