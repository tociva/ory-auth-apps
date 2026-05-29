import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { AuthApiService } from "../../core/auth-api.service";
import { KratosService } from "../../core/kratos.service";
import { SpinnerComponent } from "../../core/spinner.component";

@Component({
  selector: "app-logout",
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div class="min-h-screen w-full bg-[#367588] text-white flex items-center justify-center px-4">
      <div class="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 shadow-sm p-6 sm:p-8">
        @if (loading && !error) {
          <div class="flex items-start gap-4">
            <app-spinner label="Signing out" />
            <div class="min-w-0">
              <h2 class="text-xl sm:text-2xl font-semibold">Signing you out…</h2>
              <p class="text-sm text-white/70 mt-1">Closing your session securely. This may take a moment.</p>
            </div>
          </div>
        } @else if (error) {
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-red-200">We couldn't complete the logout</h2>
            <p class="text-sm text-white/80 mt-1 break-words">{{ error }}</p>
            <div class="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold bg-white text-[#367588] hover:bg-white/90 transition"
                (click)="reload()"
              >
                Try again
              </button>
              <a
                href="/"
                class="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition"
              >
                Go to Homepage
              </a>
            </div>
          </div>
        } @else {
          <div class="text-center">
            <h2 class="text-2xl sm:text-3xl font-bold text-green-200">You've been logged out</h2>
            <p class="text-sm sm:text-base text-white/70 mt-1">You can safely close this tab or return to the homepage.</p>
            <a
              href="/"
              class="mt-5 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold bg-white text-[#367588] hover:bg-white/90 transition"
            >
              Go to Homepage
            </a>
          </div>
        }
      </div>
    </div>
  `,
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
