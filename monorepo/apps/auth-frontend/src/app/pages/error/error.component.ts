import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { KratosService } from "../../core/kratos.service";
import { getHumanHint, pickSafeDetails, type OAuthError } from "./error-utils";

@Component({
  selector: "app-error",
  standalone: true,
  imports: [],
  template: `
    <div class="min-h-screen flex flex-col items-center justify-center bg-red-50 px-4">
      <div class="bg-white shadow-lg rounded-xl p-8 max-w-lg w-full">
        <h1 class="text-2xl font-bold text-red-600 mb-4">Oops, something went wrong</h1>

        @if (readableHint) {
          <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
            <div class="font-semibold mb-1">What this usually means</div>
            <p class="leading-relaxed">{{ readableHint }}</p>
          </div>
        }

        <div class="flex justify-between items-center mb-2">
          <span class="text-gray-700 font-semibold">Error details</span>
          <button
            type="button"
            class="text-sm px-3 py-1 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 transition"
            (click)="copy()"
          >
            {{ copied ? "Copied!" : "Copy" }}
          </button>
        </div>

        <div class="text-gray-700">
          <pre class="whitespace-pre-wrap break-all text-sm">{{ safeDetailsJson }}</pre>
        </div>

        <a href="/" class="mt-6 inline-block text-[#367588] underline">Go back home</a>
      </div>
    </div>
  `,
})
export class ErrorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly kratos = inject(KratosService);

  private error: unknown = null;
  safeDetailsJson = "Loading error details…";
  readableHint: string | null = null;
  copied = false;

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const errorId = params.get("id");
    const oauthErrorCode = params.get("error");

    // 1) OAuth error carried in the query string.
    if (oauthErrorCode) {
      const query: Record<string, string> = {};
      for (const key of params.keys) query[key] = params.get(key) ?? "";
      this.setError({
        error: oauthErrorCode,
        error_description: params.get("error_description") ?? undefined,
        error_hint: params.get("error_hint") ?? undefined,
        state: params.get("state") ?? undefined,
        query,
      } satisfies OAuthError);
      return;
    }

    // 2) Kratos error id -> fetch the details from Kratos.
    if (errorId) {
      try {
        const data = await this.kratos.getError(errorId);
        this.setError(data);
      } catch (e) {
        this.setError({ error: { reason: e instanceof Error ? e.message : "Unknown fetch error" } });
      }
      return;
    }

    // 3) Nothing usable in the query string.
    this.setError({ error: { reason: "No error details found in the URL." } });
  }

  private setError(value: unknown): void {
    this.error = value;
    this.safeDetailsJson = JSON.stringify(pickSafeDetails(value), null, 2);
    this.readableHint = getHumanHint(value);
  }

  copy(): void {
    void navigator.clipboard.writeText(JSON.stringify(pickSafeDetails(this.error), null, 2));
    this.copied = true;
    setTimeout(() => (this.copied = false), 1200);
  }
}
