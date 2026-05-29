import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { getCsrfToken } from "@idnest/shared-types";
import {
  TngCardComponent,
  TngCardContentComponent,
  TngCardFooterComponent,
  TngCardHeaderComponent,
  TngProgressSpinnerComponent,
} from "@tailng-ui/components";
import { APP_CONFIG } from "../../core/app-config";
import { KratosService } from "../../core/kratos.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    TngProgressSpinnerComponent,
    TngCardComponent,
    TngCardHeaderComponent,
    TngCardContentComponent,
    TngCardFooterComponent,
  ],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
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
