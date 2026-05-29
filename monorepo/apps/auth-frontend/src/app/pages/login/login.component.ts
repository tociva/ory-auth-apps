import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { getCsrfToken } from "@idnest/shared-types";
import {
  TngCard,
  TngCardContent,
  TngCardFooter,
  TngCardHeader,
  TngCardTitle,
} from "@tailng-ui/primitives";
import { APP_CONFIG } from "../../core/app-config";
import { KratosService } from "../../core/kratos.service";
import { SpinnerComponent } from "../../core/spinner.component";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    SpinnerComponent,
    TngCard,
    TngCardHeader,
    TngCardTitle,
    TngCardContent,
    TngCardFooter,
  ],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#367588]/10 to-white px-4">
      @if (loading) {
        <div class="flex flex-col items-center text-center">
          <app-spinner label="Checking session" />
          <h1 class="text-lg font-medium text-gray-800 mt-4 mb-1 animate-pulse">Checking session...</h1>
          <p class="text-sm text-gray-500">Preparing secure login flow, please wait.</p>
        </div>
      } @else if (error) {
        <div class="flex flex-col items-center text-center">
          <div class="bg-red-100 border border-red-300 text-red-700 p-4 rounded-xl mb-4">{{ error }}</div>
          <button
            type="button"
            class="px-4 py-2 bg-[#367588] text-white rounded hover:bg-[#2c606f]"
            (click)="goHome()"
          >
            Go to Home
          </button>
        </div>
      } @else if (flowReady) {
        <section tngCard class="w-full max-w-md rounded-2xl shadow-xl bg-white p-8">
          <header tngCardHeader class="flex flex-col items-center mb-8">
            <h1 tngCardTitle class="text-2xl font-bold text-[#367588] mb-1">Daybook.Cloud</h1>
          </header>

          <div tngCardContent class="space-y-3">
            <button
              type="button"
              class="w-full py-3 rounded-xl bg-white text-[#367588] border-2 border-[#367588]
                     hover:bg-[#367588] hover:text-white font-medium shadow-sm transition
                     cursor-pointer flex items-center justify-center gap-2"
              (click)="signInWithGoogle()"
            >
              <svg class="h-5 w-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          <footer tngCardFooter class="text-center text-sm text-gray-400 mt-6">
            By signing in, you agree to our
            <a href="/terms" class="text-[#367588] underline mx-1 hover:opacity-70">Terms &amp; Conditions</a>
            and
            <a href="/privacy" class="text-[#367588] underline mx-1 hover:opacity-70">Privacy Policy</a>.
          </footer>
        </section>
      }
    </div>
  `,
})
export class LoginComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly kratos = inject(KratosService);
  private readonly config = inject(APP_CONFIG);

  loading = true;
  error = "";
  flowReady = false;

  private flow: string | null = null;
  private csrfToken: string | null = null;
  private loginChallenge: string | null = null;
  private loginHint: string | null = null;
  private returnTo = "/";

  async ngOnInit(): Promise<void> {
    const q = this.route.snapshot.queryParamMap;
    this.flow = q.get("flow");
    this.loginChallenge = q.get("login_challenge");
    this.loginHint = q.get("login_hint");
    this.returnTo = q.get("return_to") ?? "/";

    // No flow yet: kick off the Kratos browser login flow and come back here.
    if (!this.flow) {
      const rt = this.loginChallenge
        ? `${this.config.kratosReturnTo}?login_challenge=${encodeURIComponent(this.loginChallenge)}`
        : this.config.kratosReturnTo;
      window.location.replace(this.kratos.browserLoginUrl(rt || this.returnTo));
      return;
    }

    // Flow present: load it so we can read the CSRF token to submit later.
    try {
      const flowData = await this.kratos.getLoginFlow(this.flow);
      this.csrfToken = getCsrfToken(flowData);
      this.flowReady = true;
    } catch {
      this.error = "Could not load the login flow. Please refresh the page.";
    } finally {
      this.loading = false;
    }
  }

  /**
   * Google OIDC must be a full-page form POST (not XHR) so Kratos can issue its
   * redirect to Google. We submit the flow's `csrf_token` alongside the provider.
   */
  signInWithGoogle(): void {
    if (!this.flow) {
      this.error = "No flow found. Please refresh the page.";
      return;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = this.kratos.loginActionUrl(this.flow);

    const addInput = (name: string, value: string) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addInput("provider", "google");
    if (this.csrfToken) addInput("csrf_token", this.csrfToken);
    if (this.loginHint) addInput("login_hint", this.loginHint);

    document.body.appendChild(form);
    form.submit();
  }

  goHome(): void {
    window.location.href = "/";
  }
}
