import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "idnest-error-page",
  template: `
    <div class="auth-page">
      <main class="auth-card">
        <section class="error-state">
          <div class="brand-mark" aria-hidden="true">I</div>
          <h1>Authentication request unavailable</h1>
          <p>Return to the application and start sign-in again.</p>
        </section>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPageComponent {}
