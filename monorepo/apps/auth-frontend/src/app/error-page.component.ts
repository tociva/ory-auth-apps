import { ChangeDetectionStrategy, Component } from "@angular/core";
import { AuthRecoveryComponent } from "./auth-recovery.component";

@Component({
  selector: "idnest-error-page",
  template: `
    <div class="auth-page">
      <main class="auth-card">
        <section class="error-state">
          <div class="brand-mark" aria-hidden="true">I</div>
          <h1>Authentication request unavailable</h1>
          <p>Return to the application and start sign-in again.</p>
          <idnest-auth-recovery />
        </section>
      </main>
    </div>
  `,
  imports: [AuthRecoveryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPageComponent {}
