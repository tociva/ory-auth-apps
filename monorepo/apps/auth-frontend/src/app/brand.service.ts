import { DOCUMENT } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import type { AuthBrandDefinition } from "@idnest/shared-types";

const SAFE_COLOR = /^#[0-9a-f]{6}$/i;
const SAFE_RADIUS = /^(?:0|(?:[0-9]|[12][0-9]|3[0-2])(?:px|rem|em))$/;

@Injectable({ providedIn: "root" })
export class BrandService {
  private readonly document = inject(DOCUMENT);

  apply(brand: AuthBrandDefinition): void {
    const root = this.document.documentElement.style;
    const colors: Array<[string, string]> = [
      ["--auth-primary", brand.primaryColor],
      ["--auth-secondary", brand.secondaryColor],
      ["--auth-surface", brand.surfaceColor],
      ["--auth-text", brand.textColor],
      ["--auth-muted", brand.mutedTextColor],
      ["--auth-error", brand.errorColor],
    ];
    for (const [property, value] of colors) {
      if (SAFE_COLOR.test(value)) root.setProperty(property, value);
    }
    if (SAFE_RADIUS.test(brand.borderRadius)) root.setProperty("--auth-radius", brand.borderRadius);
    root.setProperty(
      "--auth-font",
      brand.fontFamily === "roboto"
        ? "Roboto, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    );
    const background = this.safeAssetUrl(brand.backgroundImageUrl);
    root.setProperty(
      "--auth-background-image",
      background ? `url("${background}")` : "none",
    );
    this.document.title = `Sign in · ${brand.productName}`;
    const favicon = this.document.getElementById("auth-favicon") as HTMLLinkElement | null;
    if (favicon) {
      favicon.href =
        brand.faviconUrl ||
        new URL("assets/idnest-favicon.svg", this.document.baseURI).toString();
    }
  }

  safeAssetUrl(value: string | undefined): string {
    if (!value) return "";
    try {
      const url = new URL(value, this.document.baseURI);
      if (url.protocol !== "https:" && url.origin !== this.document.location.origin) return "";
      return url.toString();
    } catch {
      return "";
    }
  }
}
