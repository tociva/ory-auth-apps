import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import type { PublicAuthRecovery } from "@idnest/shared-types";

type ApplicationHomeRecovery = Extract<PublicAuthRecovery, { kind: "application_home" }>;
type MissingClientUrlRecovery = Extract<
  PublicAuthRecovery,
  { kind: "client_url_not_configured" }
>;

@Component({
  selector: "idnest-auth-recovery",
  template: `
    @if (applicationHomeRecovery(); as item) {
      <div class="recovery-actions">
        <a class="auth-button" [href]="item.homeUrl">Try again</a>
        <p class="recovery-hint">
          This will return you to {{ item.clientDisplayName }} to start a new sign-in request.
        </p>
      </div>
    } @else if (missingClientUrlRecovery(); as item) {
      <p class="recovery-hint">
        {{ item.clientDisplayName }} does not have a Client URL configured, so we can't return
        you automatically. Go back to the application and start sign-in again. If this continues,
        contact the application administrator.
      </p>
    } @else {
      <p class="recovery-hint">
        We can't determine which application started this request. Return to the application and
        start sign-in again.
      </p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthRecoveryComponent {
  @Input() recovery: PublicAuthRecovery | null = null;

  applicationHomeRecovery(): ApplicationHomeRecovery | null {
    return this.recovery?.kind === "application_home" ? this.recovery : null;
  }

  missingClientUrlRecovery(): MissingClientUrlRecovery | null {
    return this.recovery?.kind === "client_url_not_configured" ? this.recovery : null;
  }
}
