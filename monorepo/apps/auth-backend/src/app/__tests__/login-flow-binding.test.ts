import { describe, expect, it } from "vitest";
import type { KratosFlow } from "@idnest/shared-types";
import {
  isSettingsPrivilegedReauthFlow,
  settingsResumeUrlFromFlow,
  transactionTokenFromFlow,
} from "../login-flow-binding";

const authBase = "https://auth-local.idnest.cloud";
const kratosPublic = "https://kratos-local.idnest.cloud";

function flow(overrides: Partial<KratosFlow> = {}): KratosFlow {
  return {
    id: "flow-1",
    ui: { action: `${kratosPublic}/self-service/login?flow=flow-1`, method: "POST", nodes: [] },
    ...overrides,
  };
}

describe("login-flow-binding", () => {
  it("extracts OAuth transaction tokens from completion return_to", () => {
    expect(
      transactionTokenFromFlow(
        flow({
          return_to: `${authBase}/oauth2/login/complete?transaction=tok-123`,
        }),
        authBase,
      ),
    ).toBe("tok-123");
  });

  it("detects privileged settings reauth from Kratos settings return_to", () => {
    const settingsReauth = flow({
      request_url: `${kratosPublic}/self-service/login/browser?refresh=true&return_to=${encodeURIComponent(
        `${kratosPublic}/self-service/settings?flow=settings-1`,
      )}`,
    });
    expect(
      isSettingsPrivilegedReauthFlow(settingsReauth, {
        authBaseUrl: authBase,
        kratosPublicUrl: kratosPublic,
      }),
    ).toBe(true);
    expect(
      settingsResumeUrlFromFlow(settingsReauth, {
        authBaseUrl: authBase,
        kratosPublicUrl: kratosPublic,
      }),
    ).toBe(`${kratosPublic}/self-service/settings?flow=settings-1`);
  });

  it("detects privileged settings reauth from auth settings return_to", () => {
    const settingsReauth = flow({
      return_to: `${authBase}/settings?return_to=${encodeURIComponent(`${authBase}/oauth2/login/complete?transaction=tok`)}`,
    });
    expect(
      isSettingsPrivilegedReauthFlow(settingsReauth, {
        authBaseUrl: authBase,
        kratosPublicUrl: kratosPublic,
      }),
    ).toBe(true);
    expect(transactionTokenFromFlow(settingsReauth, authBase)).toBeNull();
  });

  it("does not treat OAuth completion flows as settings reauth", () => {
    const oauth = flow({
      return_to: `${authBase}/oauth2/login/complete?transaction=tok-123`,
    });
    expect(
      isSettingsPrivilegedReauthFlow(oauth, {
        authBaseUrl: authBase,
        kratosPublicUrl: kratosPublic,
      }),
    ).toBe(false);
  });
});
