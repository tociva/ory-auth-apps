import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { KratosFlow, KratosUser } from "@idnest/shared-types";
import { APP_CONFIG } from "./app-config";

export interface KratosWhoami {
  identity: KratosUser;
  [key: string]: unknown;
}

export interface KratosLogoutInit {
  logout_token?: string;
  logout_url?: string;
}

/**
 * Thin client for the Kratos *public* API. Every browser call uses
 * `withCredentials: true` so the `ory_kratos_session` cookie is sent.
 */
@Injectable({ providedIn: "root" })
export class KratosService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  whoami(): Promise<KratosWhoami> {
    return firstValueFrom(
      this.http.get<KratosWhoami>(`${this.config.kratosPublicUrl}/sessions/whoami`, {
        withCredentials: true,
      }),
    );
  }

  getLoginFlow(flowId: string): Promise<KratosFlow> {
    return firstValueFrom(
      this.http.get<KratosFlow>(`${this.config.kratosPublicUrl}/self-service/login/flows`, {
        params: { id: flowId },
        withCredentials: true,
      }),
    );
  }

  browserLoginUrl(returnTo: string): string {
    return `${this.config.kratosPublicUrl}/self-service/login/browser?return_to=${encodeURIComponent(
      returnTo,
    )}`;
  }

  loginActionUrl(flowId: string): string {
    return `${this.config.kratosPublicUrl}/self-service/login?flow=${encodeURIComponent(flowId)}`;
  }

  initLogout(): Promise<KratosLogoutInit> {
    return firstValueFrom(
      this.http.get<KratosLogoutInit>(`${this.config.kratosPublicUrl}/self-service/logout/browser`, {
        withCredentials: true,
        headers: { Accept: "application/json" },
      }),
    );
  }

  logoutTokenUrl(token: string): string {
    return `${this.config.kratosPublicUrl}/self-service/logout?token=${encodeURIComponent(token)}`;
  }

  performLogout(url: string): Promise<string> {
    return firstValueFrom(
      this.http.get(url, { withCredentials: true, responseType: "text" }),
    );
  }

  getError(id: string): Promise<unknown> {
    return firstValueFrom(
      this.http.get(`${this.config.kratosPublicUrl}/self-service/errors`, {
        params: { id },
        withCredentials: true,
      }),
    );
  }
}
