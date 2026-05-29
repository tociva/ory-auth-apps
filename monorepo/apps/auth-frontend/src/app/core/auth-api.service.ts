import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { HydraRedirectResponse, KratosUserClaims } from "@idnest/shared-types";
import { APP_CONFIG } from "./app-config";

export interface AcceptLoginPayload {
  login_challenge: string;
  subject: string;
  id_token: KratosUserClaims;
}

/**
 * Client for the auth-backend Hydra proxy. The backend keeps the Hydra/Kratos
 * admin URLs server-side; the browser only ever talks to these routes.
 */
@Injectable({ providedIn: "root" })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  private base(): string {
    return `${this.config.authBackendUrl}/hydra`;
  }

  acceptLogin(payload: AcceptLoginPayload): Promise<HydraRedirectResponse> {
    return firstValueFrom(
      this.http.post<HydraRedirectResponse>(`${this.base()}/accept-login`, payload, {
        withCredentials: true,
      }),
    );
  }

  acceptConsent(consentChallenge: string): Promise<HydraRedirectResponse> {
    return firstValueFrom(
      this.http.post<HydraRedirectResponse>(
        `${this.base()}/accept-consent`,
        { consent_challenge: consentChallenge },
        { withCredentials: true },
      ),
    );
  }

  rejectConsent(consentChallenge: string): Promise<HydraRedirectResponse> {
    return firstValueFrom(
      this.http.post<HydraRedirectResponse>(
        `${this.base()}/reject-consent`,
        { consent_challenge: consentChallenge },
        { withCredentials: true },
      ),
    );
  }

  acceptLogout(logoutChallenge: string): Promise<HydraRedirectResponse> {
    return firstValueFrom(
      this.http.post<HydraRedirectResponse>(
        `${this.base()}/accept-logout`,
        { logout_challenge: logoutChallenge },
        { withCredentials: true },
      ),
    );
  }
}
