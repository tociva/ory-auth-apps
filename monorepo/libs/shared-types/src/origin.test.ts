import { describe, expect, it } from "vitest";
import { isAllowedOrigin, normalizeOrigin } from "./origin";

describe("origin allowlist", () => {
  it("normalizes origins", () => {
    expect(normalizeOrigin("https://admin.idnest.cloud/settings")).toBe("https://admin.idnest.cloud");
    expect(normalizeOrigin("not a url")).toBeNull();
  });

  it("allows exact origins", () => {
    expect(isAllowedOrigin("https://admin-local.idnest.cloud/page", ["https://admin-local.idnest.cloud"])).toBe(
      true,
    );
    expect(isAllowedOrigin("https://app-local.daybook.cloud", ["https://admin-local.idnest.cloud"])).toBe(
      false,
    );
  });

  it("allows bounded wildcard subdomains", () => {
    const allowedOrigins = ["https://*.idnest.cloud", "https://*.daybook.cloud"];

    expect(isAllowedOrigin("https://admin.idnest.cloud", allowedOrigins)).toBe(true);
    expect(isAllowedOrigin("https://app.daybook.cloud", allowedOrigins)).toBe(true);
    expect(isAllowedOrigin("https://app-dev.daybook.cloud", allowedOrigins)).toBe(true);
    expect(isAllowedOrigin("https://tenant.preview.daybook.cloud", allowedOrigins)).toBe(true);
  });

  it("rejects origins outside bounded wildcard domains", () => {
    const allowedOrigins = ["https://*.idnest.cloud", "https://*.daybook.cloud"];

    expect(isAllowedOrigin("https://evil.com", allowedOrigins)).toBe(false);
    expect(isAllowedOrigin("https://daybook.cloud.evil.com", allowedOrigins)).toBe(false);
    expect(isAllowedOrigin("http://app.daybook.cloud", allowedOrigins)).toBe(false);
    expect(isAllowedOrigin("https://daybook.cloud", allowedOrigins)).toBe(false);
  });

  it("does not allow bare wildcard origins", () => {
    expect(isAllowedOrigin("https://app.daybook.cloud", ["*"])).toBe(false);
  });
});
