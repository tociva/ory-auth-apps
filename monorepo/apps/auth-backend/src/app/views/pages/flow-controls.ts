import type { KratosFlow, KratosUiNode } from "@idnest/shared-types";

export interface FlowHiddenInput {
  name: string;
  value: string;
}

export interface FlowSubmitButton {
  name: string;
  value: string;
  provider: string;
  label: string;
  disabled: boolean;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function providerName(value: string): string {
  if (!value) return "provider";
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buttonLabel(node: KratosUiNode, provider: string, fallbackVerb: string): string {
  const label = node.meta?.label?.text;
  if (typeof label === "string" && label.trim()) return label;
  return `${fallbackVerb} ${providerName(provider)}`;
}

export function hiddenInputsFromFlow(flow: Pick<KratosFlow, "ui">): FlowHiddenInput[] {
  return flow.ui.nodes
    .filter((node) => node.type === "input" && node.attributes.type === "hidden")
    .map((node) => ({ name: node.attributes.name, value: stringValue(node.attributes.value) }))
    .filter((input): input is FlowHiddenInput => typeof input.name === "string" && input.name.length > 0);
}

export function oidcSubmitButtonsFromFlow(
  flow: Pick<KratosFlow, "ui">,
  fallbackVerb: string,
): FlowSubmitButton[] {
  return flow.ui.nodes
    .filter((node) => node.group === "oidc" && node.type === "input" && node.attributes.type === "submit")
    .map((node) => {
      const name = node.attributes.name;
      const value = stringValue(node.attributes.value);
      if (typeof name !== "string" || !name || !value) return null;
      return {
        name,
        value,
        provider: value,
        label: buttonLabel(node, value, fallbackVerb),
        disabled: node.attributes.disabled === true,
      };
    })
    .filter((button): button is FlowSubmitButton => button !== null);
}
