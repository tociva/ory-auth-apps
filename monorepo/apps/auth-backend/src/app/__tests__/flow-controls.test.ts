import { describe, expect, it } from "vitest";
import type { KratosFlow } from "@idnest/shared-types";
import { hiddenInputsFromFlow, oidcSubmitButtonsFromFlow } from "../views/pages/flow-controls";
import { renderLogin } from "../views/pages/login";

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
