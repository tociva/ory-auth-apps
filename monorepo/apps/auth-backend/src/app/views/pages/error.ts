import type { PublicAuthRecovery } from "@idnest/shared-types";
import { esc } from "../escape";
import { layout } from "../layout";

export interface ErrorViewModel {
  /** Safe, whitelisted details (see error-utils.pickSafeDetails). */
  safeDetails: Record<string, unknown>;
  /** Optional human-friendly hint for common OAuth pitfalls. */
  hint?: string | null;
  recovery?: PublicAuthRecovery;
}

function recoveryBlock(recovery: PublicAuthRecovery | undefined): string {
  if (!recovery || recovery.kind === "request_context_unavailable") {
    return `<div class="recovery-panel">
      <p class="hint-body">We can't determine which application started this request. Return to the application and start sign-in again.</p>
    </div>`;
  }
  if (recovery.kind === "client_url_not_configured") {
    return `<div class="recovery-panel">
      <p class="hint-body">${esc(recovery.clientDisplayName)} does not have a Client URL configured, so we can't return you automatically. Go back to the application and start sign-in again. If this continues, contact the application administrator.</p>
    </div>`;
  }
  return `<div class="recovery-panel">
    <a href="${esc(recovery.homeUrl)}" class="btn btn-primary">Try again</a>
    <p class="recovery-hint">This will return you to ${esc(recovery.clientDisplayName)} to start a new sign-in request.</p>
  </div>`;
}

/** Renders the error page. The Copy button uses a tiny inline script. */
export function renderError(vm: ErrorViewModel): string {
  const json = JSON.stringify(vm.safeDetails, null, 2);

  const hintBlock = vm.hint
    ? `<div class="alert alert-warning">
        <strong class="hint-title">What this usually means</strong>
        <p class="hint-body">${esc(vm.hint)}</p>
      </div>`
    : "";

  const body = `<div class="page-center">
  <main class="card card-error">
    <h1 class="error-title">Oops, something went wrong</h1>
    ${hintBlock}
    <div class="details-row">
      <span class="details-label">Error details</span>
      <button type="button" class="btn btn-outline btn-sm" id="copy-btn">Copy</button>
    </div>
    <pre class="error-pre" id="details">${esc(json)}</pre>
    ${recoveryBlock(vm.recovery)}
  </main>
</div>`;

  const bodyScript = `
    var btn = document.getElementById('copy-btn');
    var pre = document.getElementById('details');
    if (btn && pre) {
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(pre.textContent || '').then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
        });
      });
    }`;

  return layout({ title: "Error · Idnest", body, bodyScript });
}
