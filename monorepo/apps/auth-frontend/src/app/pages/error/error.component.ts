import { Component, inject, type OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  TngCardComponent,
  TngCardContentComponent,
  TngCardFooterComponent,
  TngCardHeaderComponent,
  TngLabelComponent,
} from "@tailng-ui/components";
import { KratosService } from "../../core/kratos.service";
import { getHumanHint, pickSafeDetails, type OAuthError } from "./error-utils";

@Component({
  selector: "app-error",
  standalone: true,
  imports: [TngCardComponent, TngCardHeaderComponent, TngCardContentComponent, TngCardFooterComponent, TngLabelComponent],
  templateUrl: "./error.component.html",
  styleUrl: "./error.component.css",
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
