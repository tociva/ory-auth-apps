import { esc } from "./escape";
import { layout } from "./layout";

export interface ErrorViewModel {
  /** Safe, whitelisted details (see error-utils.pickSafeDetails). */
  safeDetails: Record<string, unknown>;
  /** Optional human-friendly hint for common OAuth pitfalls. */
  hint?: string | null;
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
    <div class="card-footer">
      <a href="/" class="link">Go back home</a>
    </div>
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

  return layout({ title: "Error · idnest", body, bodyScript });
}
