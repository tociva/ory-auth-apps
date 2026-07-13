import { esc } from "../escape";
import { IDNEST_LOGO } from "../icons";
import { layout } from "../layout";
import type { FlowHiddenInput, FlowSubmitButton } from "./flow-controls";
import { renderOidcForm } from "./oidc-form";

export interface SettingsViewModel {
  /** Kratos settings action URL the form POSTs to (full-page, browser -> Kratos). */
  actionUrl: string;
  /** Hidden inputs from the Kratos flow, including csrf_token. */
  hiddenInputs: FlowHiddenInput[];
  /** OIDC link/unlink submit buttons from the Kratos settings flow. */
  providers: FlowSubmitButton[];
  /** Optional allowlisted app URL to leave settings without making changes. */
  returnTo?: string | null;
}

export function renderSettings(vm: SettingsViewModel): string {
  const backLink = vm.returnTo
    ? `<div class="card-footer"><a href="${esc(vm.returnTo)}" class="link">Back to app</a></div>`
    : "";

  const body = `<div class="page-center">
  <main class="card">
    <div class="card-header">
      ${IDNEST_LOGO}
      <p class="brand-tagline">Account settings</p>
    </div>

    <hr class="divider" />

    ${renderOidcForm({
      actionUrl: vm.actionUrl,
      hiddenInputs: vm.hiddenInputs,
      buttons: vm.providers,
      emptyText: "No social sign-in methods are available.",
    })}

    ${backLink}
  </main>
</div>`;

  return layout({ title: "Account settings · Idnest", body });
}
