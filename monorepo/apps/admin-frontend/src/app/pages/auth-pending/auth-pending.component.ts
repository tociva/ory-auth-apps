import { Component, inject } from "@angular/core";
import { AdminAuthService } from "../../core/admin-auth.service";

@Component({
  selector: "app-auth-pending",
  standalone: true,
  template: `
    <main class="pending-page" aria-live="polite">
      <section class="pending-panel">
        <div class="mark" aria-hidden="true">ID</div>
        <h1>Sign-in in progress</h1>
        <p>Complete the consent prompt in the tab that started sign-in.</p>
        <button type="button" (click)="startOver()">Start over</button>
      </section>
    </main>
  `,
  styles: [
    `
      .pending-page {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 1rem;
        background: var(--tng-color-background, #eef4fb);
        font: var(--tng-font-body-md);
      }

      .pending-panel {
        width: min(100%, 26rem);
        padding: 2rem;
        text-align: center;
        border: 1px solid var(--tng-color-border, #cdd9e8);
        border-radius: 0.75rem;
        background: var(--tng-color-surface, #fff);
        box-shadow: 0 16px 40px -24px rgba(15, 23, 42, 0.45);
      }

      .mark {
        display: inline-grid;
        width: 3rem;
        height: 3rem;
        margin-bottom: 1rem;
        place-items: center;
        border-radius: 0.75rem;
        background: var(--tng-color-primary, #2563eb);
        color: #fff;
        font-weight: 800;
      }

      h1 {
        margin: 0;
        color: var(--tng-color-text, #1f2937);
        font: var(--tng-font-heading-md);
      }

      p {
        margin: 0.5rem 0 1.25rem;
        color: var(--tng-color-text-secondary, #4b5563);
      }

      button {
        min-height: 2.5rem;
        padding: 0 1rem;
        border: 1px solid var(--tng-color-primary, #2563eb);
        border-radius: 0.5rem;
        background: var(--tng-color-primary, #2563eb);
        color: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
    `,
  ],
})
export class AuthPendingComponent {
  private readonly auth = inject(AdminAuthService);

  startOver(): void {
    this.auth.clearPendingSignIn();
    this.auth.signIn(window.location.origin);
  }
}
