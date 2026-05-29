import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, type OnDestroy, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import type { KratosUser } from "@idnest/shared-types";
import { APP_CONFIG } from "../../core/app-config";
import { AuthApiService } from "../../core/auth-api.service";
import { KratosService } from "../../core/kratos.service";
import { SpinnerComponent } from "../../core/spinner.component";

const MAX_RETRIES = 5;

@Component({
  selector: "app-handle-login-return",
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        @if (error) {
          <div class="text-red-700 bg-red-100 border border-red-300 rounded-lg p-4">
            <div class="text-xl font-semibold mb-2">Authentication Issue</div>
            <p class="text-sm mb-4">{{ error }}</p>
            @if (loginChallenge) {
              <button
                type="button"
                class="mt-2 px-4 py-2 bg-[#367588] text-white text-sm font-medium rounded-lg hover:bg-[#2c606f] transition cursor-pointer"
                (click)="retry()"
              >
                Retry Login
              </button>
            }
          </div>
        } @else {
          <div class="flex justify-center mb-4"><app-spinner label="Authenticating" /></div>
          <h1 class="text-lg font-medium text-gray-800 mb-2 animate-pulse">Authenticating...</h1>
          <p class="text-sm text-gray-500">Verifying session and redirecting you to the consent screen.</p>
        }
      </div>
    </div>
  `,
})
export class HandleLoginReturnComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly kratos = inject(KratosService);
  private readonly api = inject(AuthApiService);
  private readonly config = inject(APP_CONFIG);

  error = "";
  loginChallenge: string | null = null;

  private user?: KratosUser;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loginChallenge = this.route.snapshot.queryParamMap.get("login_challenge");
    const initialDelay = document.cookie.includes("ory_kratos_session") ? 150 : 400;
    this.timer = setTimeout(() => this.fetchWhoami(0), initialDelay);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private async fetchWhoami(retries: number): Promise<void> {
    try {
      const data = await this.kratos.whoami();
      this.user = data.identity;
      await this.acceptLogin();
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      if (status === 401) {
        if (retries < MAX_RETRIES) {
          this.timer = setTimeout(() => this.fetchWhoami(retries + 1), 400 + retries * 200);
          return;
        }
        this.error = "We couldn't confirm your login. Please click below to try again.";
        return;
      }
      this.error = e instanceof Error ? e.message : "Session error";
    }
  }

  private async acceptLogin(): Promise<void> {
    if (!this.loginChallenge || !this.user) return;
    try {
      const { redirect_to } = await this.api.acceptLogin({
        login_challenge: this.loginChallenge,
        subject: this.user.id,
        id_token: {
          name: this.user.traits?.name,
          email: this.user.traits?.email,
          picture: this.user.traits?.picture,
        },
      });
      window.location.href = redirect_to;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "An unknown error occurred";
    }
  }

  retry(): void {
    if (!this.loginChallenge) return;
    const returnUrl = `${this.config.kratosReturnTo}?login_challenge=${encodeURIComponent(
      this.loginChallenge,
    )}`;
    window.location.href = this.kratos.browserLoginUrl(returnUrl);
  }
}
