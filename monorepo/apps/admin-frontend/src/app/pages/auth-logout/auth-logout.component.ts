import { Component, inject, type OnInit } from "@angular/core";
import { AdminAuthService } from "../../core/admin-auth.service";

@Component({
  selector: "app-auth-logout",
  standalone: true,
  template: `
    <main class="logout-page" aria-live="polite">
      <section class="logout-panel">
        <div class="mark" aria-hidden="true">ID</div>
        <h1>You are logged out</h1>
        <p>Your admin session has ended on this browser.</p>
        <button type="button" (click)="loginAgain()">Log in again</button>
      </section>
    </main>
  `,
  styles: [
    `
      .logout-page {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 1rem;
        background: var(--tng-color-background, #eef4fb);
        font: var(--tng-font-body-md);
      }

      .logout-panel {
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

      button:hover {
        filter: brightness(0.95);
      }
    `,
  ],
})
export class AuthLogoutComponent implements OnInit {
  private readonly auth = inject(AdminAuthService);

  ngOnInit(): void {
    if (new URLSearchParams(window.location.search).get("sso") === "done") {
      this.auth.clearLocalSession();
      return;
    }
    void this.auth.signOut();
  }

  loginAgain(): void {
    this.auth.signIn(window.location.origin);
  }
}
