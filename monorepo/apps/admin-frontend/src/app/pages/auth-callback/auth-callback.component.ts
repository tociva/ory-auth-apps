import { Component, inject, type OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AdminAuthService } from "../../core/admin-auth.service";

@Component({
  selector: "app-auth-callback",
  standalone: true,
  template: `
    <main class="auth-status" aria-live="polite">
      <section class="auth-panel">
        <p>{{ message }}</p>
        @if (failed) {
          <button type="button" (click)="loginAgain()">Log in again</button>
        }
      </section>
    </main>
  `,
  styles: [
    `
      .auth-status {
        display: grid;
        min-height: 100vh;
        place-items: center;
        color: var(--tng-color-text-secondary);
        font: var(--tng-font-body-md);
      }

      .auth-panel {
        display: grid;
        gap: 1rem;
        justify-items: center;
        padding: 1rem;
        text-align: center;
      }

      p {
        margin: 0;
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
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected message = "Completing sign in";
  protected failed = false;

  async ngOnInit(): Promise<void> {
    try {
      const returnTo = await this.auth.completeSignIn();
      await this.router.navigateByUrl(returnTo);
    } catch (e) {
      this.auth.clearLocalSession();
      this.message = e instanceof Error ? e.message : "Sign in failed";
      this.failed = true;
    }
  }

  loginAgain(): void {
    this.auth.signIn(window.location.origin);
  }
}
