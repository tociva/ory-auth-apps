import { esc } from "../escape";
import { APPLE_ICON, GOOGLE_ICON } from "../icons";
import type { FlowHiddenInput, FlowSubmitButton } from "./flow-controls";

function providerIcon(provider: string): string {
  switch (provider.toLowerCase()) {
    case "apple":
      return APPLE_ICON;
    case "google":
      return GOOGLE_ICON;
    default:
      return "";
  }
}

function providerClass(provider: string): string {
  switch (provider.toLowerCase()) {
    case "apple":
      return "btn-apple";
    case "google":
      return "btn-google";
    default:
      return "btn-provider";
  }
}

export function renderOidcForm(opts: {
  actionUrl: string;
  hiddenInputs: FlowHiddenInput[];
  buttons: FlowSubmitButton[];
  emptyText: string;
}): string {
  if (!opts.buttons.length) {
    return `<div class="alert alert-warning">${esc(opts.emptyText)}</div>`;
  }

  const hidden = opts.hiddenInputs
    .map((input) => `<input type="hidden" name="${esc(input.name)}" value="${esc(input.value)}" />`)
    .join("\n        ");

  const buttons = opts.buttons
    .map(
      (button) => `<button type="submit" name="${esc(button.name)}" value="${esc(button.value)}" class="btn ${providerClass(
        button.provider,
      )}"${button.disabled ? " disabled" : ""}>
          ${providerIcon(button.provider)}
          <span>${esc(button.label)}</span>
        </button>`,
    )
    .join("\n        ");

  return `<form method="POST" action="${esc(opts.actionUrl)}" class="oidc-form">
        ${hidden}
        ${buttons}
    </form>`;
}
