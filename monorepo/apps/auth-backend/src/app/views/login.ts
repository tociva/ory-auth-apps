import { esc } from "./escape";
import { layout } from "./layout";

const GOOGLE_ICON = `<svg class="google-icon" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>`;

export interface LoginViewModel {
  /** Kratos login action URL the form POSTs to (full-page, browser → Kratos). */
  actionUrl: string;
  /** The flow's csrf_token, rendered as a hidden input. */
  csrfToken: string | null;
  /** Optional Google login_hint to pre-fill the account. */
  loginHint?: string | null;
}

/**
 * The single interactive page: a "Sign in with Google" button that does a
 * full-page form POST to Kratos (which then redirects to Google's consent
 * screen). No client-side JS required — Kratos needs a real navigation, not XHR.
 */
export function renderLogin(vm: LoginViewModel): string {
  const hidden = [
    `<input type="hidden" name="provider" value="google" />`,
    vm.csrfToken ? `<input type="hidden" name="csrf_token" value="${esc(vm.csrfToken)}" />` : "",
    vm.loginHint ? `<input type="hidden" name="login_hint" value="${esc(vm.loginHint)}" />` : "",
  ].join("\n        ");

  const body = `<div class="page-center">
  <main class="card">
    <div class="card-header">
      <h1 class="brand-name">idnest</h1>
      <p class="brand-tagline">Sign in to continue</p>
    </div>

    <form method="POST" action="${esc(vm.actionUrl)}">
        ${hidden}
        <button type="submit" class="btn btn-outline btn-google">
          ${GOOGLE_ICON}
          <span>Sign in with Google</span>
        </button>
    </form>

    <p class="terms-text">
      By signing in, you agree to our
      <a href="/terms" class="link">Terms &amp; Conditions</a>
      and
      <a href="/privacy" class="link">Privacy Policy</a>.
    </p>
  </main>
</div>`;

  return layout({ title: "Sign in · idnest", body });
}
