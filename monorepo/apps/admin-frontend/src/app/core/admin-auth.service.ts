import { inject, Injectable } from "@angular/core";
import { ADMIN_CONFIG } from "./admin-config";

interface AdminMeResponse {
  csrfToken?: string;
}

@Injectable({ providedIn: "root" })
export class AdminAuthService {
  private readonly config = inject(ADMIN_CONFIG);
  private csrfToken = "";

  initialize(): void {
    // BFF sessions live in an HttpOnly cookie; there is no browser token state.
  }

  setCsrfToken(token: string | undefined): void {
    this.csrfToken = token ?? "";
  }

  getCsrfToken(): string {
    return this.csrfToken;
  }

  async ensureCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    const res = await fetch(`${this.adminBase()}/me`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return "";
    const body = (await res.json().catch(() => null)) as AdminMeResponse | null;
    this.setCsrfToken(body?.csrfToken);
    return this.csrfToken;
  }

  signIn(returnTo = window.location.href): void {
    const params = new URLSearchParams({ return_to: sameOriginPath(returnTo) ?? "/" });
    window.location.href = `${this.adminBase()}/auth/login?${params.toString()}`;
  }

  async signOut(): Promise<void> {
    const csrf = await this.ensureCsrfToken();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (csrf) headers["X-Admin-CSRF"] = csrf;
    const res = await fetch(`${this.adminBase()}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
    });
    this.clearLocalSession();
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as { redirect_to?: string } | null;
      window.location.href = body?.redirect_to || "/auth/logout";
      return;
    }
    window.location.href = "/auth/logout";
  }

  clearLocalSession(): void {
    this.csrfToken = "";
  }

  clearPendingSignIn(): void {
    // Kept for the old callback/pending components; BFF login has no browser transaction.
  }

  completeSignIn(): Promise<string> {
    return Promise.resolve("/");
  }

  private adminBase(): string {
    return `${this.config.apiBaseUrl.replace(/\/+$/, "")}/admin`;
  }
}

function sameOriginPath(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
