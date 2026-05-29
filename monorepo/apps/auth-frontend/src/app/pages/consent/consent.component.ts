import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { AuthApiService } from "../../core/auth-api.service";
import { SpinnerComponent } from "../../core/spinner.component";

@Component({
  selector: "app-consent",
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: "./consent.component.html",
  styleUrl: "./consent.component.css",
})
export class ConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AuthApiService);

  error: string | null = null;

  async ngOnInit(): Promise<void> {
    const consentChallenge = this.route.snapshot.queryParamMap.get("consent_challenge");
    if (!consentChallenge) {
      this.error = "No consent_challenge provided!";
      return;
    }

    try {
      const { redirect_to } = await this.api.acceptConsent(consentChallenge);
      if (redirect_to) {
        window.location.href = redirect_to;
      } else {
        this.error = "No redirect URL received";
      }
    } catch (e) {
      this.error = this.describe(e);
    }
  }

  private describe(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      return e.error?.error || e.message || "Consent accept failed";
    }
    return e instanceof Error ? e.message : "An unknown error occurred";
  }

  goToLogin(): void {
    window.location.href = "/login";
  }
}
