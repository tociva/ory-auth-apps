import { describe, expect, it } from "vitest";
import type { KratosFlow } from "@idnest/shared-types";
import {
  factorSettingsNodesFromFlow,
  hiddenInputsFromFlow,
  oidcSubmitButtonsFromFlow,
} from "../views/pages/flow-controls";
import { renderLogin } from "../views/pages/login";
import { renderSettings } from "../views/pages/settings";

const flow: KratosFlow = {
  id: "flow-1",
  ui: {
    action: "https://kratos/self-service/login?flow=flow-1",
    method: "POST",
    nodes: [
      { type: "input", group: "default", attributes: { name: "csrf_token", value: "tok-123", type: "hidden" } },
      {
        type: "input",
        group: "oidc",
        attributes: { name: "provider", value: "google", type: "submit" },
        meta: { label: { text: "Continue with Google" } },
      },
      {
        type: "input",
        group: "oidc",
        attributes: { name: "provider", value: "apple", type: "submit" },
        meta: { label: { text: "Continue with Apple" } },
      },
    ],
  },
};

const settingsFlow: KratosFlow = {
  id: "settings-flow-1",
  ui: {
    action: "https://kratos/self-service/settings?flow=settings-flow-1",
    method: "POST",
    nodes: [
      { type: "input", group: "default", attributes: { name: "csrf_token", value: "settings-csrf", type: "hidden" } },
      {
        type: "img",
        group: "totp",
        attributes: { src: "data:image/png;base64,qr", node_type: "img" },
        meta: { label: { text: "Authenticator QR" } },
      },
      {
        type: "input",
        group: "totp",
        attributes: { name: "totp_code", type: "text", required: true },
        meta: { label: { text: "Authentication code" } },
      },
      {
        type: "input",
        group: "totp",
        attributes: { name: "method", value: "totp", type: "submit" },
        meta: { label: { text: "Save authenticator" } },
      },
    ],
  },
};

describe("OIDC flow controls", () => {
  it("extracts hidden inputs and provider submit buttons from Kratos flow nodes", () => {
    expect(hiddenInputsFromFlow(flow)).toEqual([{ name: "csrf_token", value: "tok-123" }]);
    expect(oidcSubmitButtonsFromFlow(flow, "Continue with")).toEqual([
      {
        name: "provider",
        value: "google",
        provider: "google",
        label: "Continue with Google",
        disabled: false,
      },
      {
        name: "provider",
        value: "apple",
        provider: "apple",
        label: "Continue with Apple",
        disabled: false,
      },
    ]);
  });

  it("renders Google and Apple provider buttons with the CSRF token preserved", () => {
    const html = renderLogin({
      actionUrl: flow.ui.action,
      hiddenInputs: hiddenInputsFromFlow(flow),
      providers: oidcSubmitButtonsFromFlow(flow, "Continue with"),
    });

    expect(html).toContain('name="csrf_token" value="tok-123"');
    expect(html).toContain('name="provider" value="google"');
    expect(html).toContain('name="provider" value="apple"');
    expect(html).toContain("Continue with Google");
    expect(html).toContain("Continue with Apple");
  });
});

describe("factor settings controls", () => {
  it("extracts TOTP enrollment nodes from a settings flow", () => {
    expect(factorSettingsNodesFromFlow(settingsFlow)).toEqual([
      { kind: "img", src: "data:image/png;base64,qr", alt: "Authenticator QR" },
      {
        kind: "input",
        name: "totp_code",
        value: "",
        inputType: "text",
        label: "Authentication code",
        required: true,
        disabled: false,
      },
      {
        kind: "submit",
        name: "method",
        value: "totp",
        label: "Save authenticator",
        disabled: false,
      },
    ]);
  });

  it("renders authenticator enrollment controls in settings", () => {
    const html = renderSettings({
      actionUrl: settingsFlow.ui.action,
      hiddenInputs: hiddenInputsFromFlow(settingsFlow),
      providers: [],
      factorNodes: factorSettingsNodesFromFlow(settingsFlow),
      returnTo: "https://auth-local.idnest.cloud/oauth2/login/complete?transaction=tok",
    });

    expect(html).toContain("Authenticator app");
    expect(html).toContain('name="totp_code"');
    expect(html).toContain("Save authenticator");
    expect(html).toContain("Continue sign-in");
    expect(html).toContain("/oauth2/login/complete?transaction=tok");
  });
});
