import { esc } from "../escape";
import { layout } from "../layout";
import { DAYBOOK_LOGO, GOOGLE_ICON } from "../icons";

export interface LoginViewModel {
  /** Kratos login action URL the form POSTs to (full-page, browser → Kratos). */
  actionUrl: string;
  /** The flow's csrf_token, rendered as a hidden input. */
  csrfToken: string | null;
  /** Optional Google login_hint to pre-fill the account. */
  loginHint?: string | null;
}

/**
 * The single interactive page: a "Continue with Google" button that does a
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
      ${DAYBOOK_LOGO}
      <p class="brand-tagline">Sign in to continue</p>
    </div>

    <hr class="divider" />

    <form method="POST" action="${esc(vm.actionUrl)}">
        ${hidden}
        <button type="submit" class="btn btn-google">
          ${GOOGLE_ICON}
          <span>Continue with Google</span>
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

  return layout({ title: "Sign in · Daybook.Cloud", body });
}
