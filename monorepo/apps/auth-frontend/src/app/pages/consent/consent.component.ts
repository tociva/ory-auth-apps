import { HttpErrorResponse } from "@angular/common/http";
import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { AuthApiService } from "../../core/auth-api.service";
import { SpinnerComponent } from "../../core/spinner.component";

@Component({
  selector: "app-consent",
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-4">
      @if (error) {
        <div class="bg-red-100 border border-red-300 text-red-700 p-4 rounded-xl">Error: {{ error }}</div>
        <button
          type="button"
          class="px-4 py-2 bg-[#367588] text-white rounded hover:bg-[#2c606f]"
          (click)="goToLogin()"
        >
          Go to Login
        </button>
      } @else {
        <app-spinner label="Processing consent" />
        <h1 class="text-lg font-medium text-gray-800 animate-pulse">Processing consent…</h1>
        <p class="text-sm text-gray-500">Verifying and redirecting you to the app.</p>
      }
    </div>
  `,
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
