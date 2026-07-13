import { HttpClient, type HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { AdminAuthService } from "./admin-auth.service";
import { ADMIN_CONFIG } from "./admin-config";
import { ProgressService } from "./progress/progress.service";
import type {
  AdminIdentity,
  AdminMe,
  ClientAccessGrant,
  ClientFormValue,
  HydraClient,
  KratosSession,
} from "./admin-types";

/** Client for admin-backend. BFF auth uses an HttpOnly session cookie + CSRF. */
@Injectable({ providedIn: "root" })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AdminAuthService);
  private readonly config = inject(ADMIN_CONFIG);
  private readonly progress = inject(ProgressService);

  private base(): string {
    return `${this.config.apiBaseUrl}/admin`;
  }

  /** Wraps an async operation with the top-bar progress indicator. */
  private async withProgress<T>(fn: () => Promise<T>): Promise<T> {
    this.progress.show();
    try {
      return await fn();
    } finally {
      this.progress.hideOne();
    }
  }

  private get<T>(path: string): Promise<T> {
    return this.withProgress(async () => {
      const result = await firstValueFrom(
        this.http.get<T>(`${this.base()}${path}`, { withCredentials: true }),
      );
      this.captureCsrf(result);
      return result;
    });
  }

  private async unsafeHeaders(): Promise<Record<string, string>> {
    const csrfToken = await this.auth.ensureCsrfToken();
    return csrfToken ? { "X-Admin-CSRF": csrfToken } : {};
  }

  private async post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.withProgress(async () => {
      const headers = await this.unsafeHeaders();
      return firstValueFrom(
        this.http.post<T>(`${this.base()}${path}`, body, { headers, withCredentials: true }),
      );
    });
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.withProgress(async () => {
      const headers = await this.unsafeHeaders();
      return firstValueFrom(
        this.http.put<T>(`${this.base()}${path}`, body, { headers, withCredentials: true }),
      );
    });
  }

  private async delete<T>(path: string): Promise<T> {
    return this.withProgress(async () => {
      const headers = await this.unsafeHeaders();
      return firstValueFrom(
        this.http.delete<T>(`${this.base()}${path}`, { headers, withCredentials: true }),
      );
    });
  }

  private captureCsrf(value: unknown): void {
    if (value && typeof value === "object" && "csrfToken" in value) {
      const csrfToken = (value as { csrfToken?: unknown }).csrfToken;
      this.auth.setCsrfToken(typeof csrfToken === "string" ? csrfToken : undefined);
    }
  }

  // --- Authorization probe ---
  me(): Promise<AdminMe> {
    return this.get<AdminMe>("/me");
  }

  // --- Identities ---
  listIdentities(pageToken?: string): Promise<AdminIdentity[]> {
    const qs = pageToken ? `?page_token=${encodeURIComponent(pageToken)}` : "";
    return this.get<AdminIdentity[]>(`/identities${qs}`);
  }

  getIdentity(id: string): Promise<AdminIdentity> {
    return this.get<AdminIdentity>(`/identities/${encodeURIComponent(id)}`);
  }

  deactivateIdentity(id: string): Promise<AdminIdentity> {
    return this.post<AdminIdentity>(`/identities/${encodeURIComponent(id)}/deactivate`);
  }

  deleteIdentity(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.delete(`/identities/${encodeURIComponent(id)}`);
  }

  setAdminRole(id: string, admin: boolean): Promise<AdminIdentity> {
    return this.post<AdminIdentity>(`/identities/${encodeURIComponent(id)}/role`, { admin });
  }

  listIdentityClientAccess(id: string): Promise<ClientAccessGrant[]> {
    return this.get<ClientAccessGrant[]>(`/identities/${encodeURIComponent(id)}/client-access`);
  }

  grantIdentityClientAccess(id: string, clientId: string, role = "user"): Promise<ClientAccessGrant> {
    return this.post<ClientAccessGrant>(
      `/identities/${encodeURIComponent(id)}/client-access/${encodeURIComponent(clientId)}`,
      { role },
    );
  }

  revokeIdentityClientAccess(
    id: string,
    clientId: string,
  ): Promise<{ revoked: boolean; identity_id: string; client_id: string }> {
    return this.delete(
      `/identities/${encodeURIComponent(id)}/client-access/${encodeURIComponent(clientId)}`,
    );
  }

  // --- Sessions ---
  listIdentitySessions(id: string): Promise<KratosSession[]> {
    return this.get<KratosSession[]>(`/identities/${encodeURIComponent(id)}/sessions`);
  }

  revokeIdentitySessions(id: string): Promise<{ revoked: boolean; id: string }> {
    return this.delete(`/identities/${encodeURIComponent(id)}/sessions`);
  }

  revokeSession(sessionId: string): Promise<{ revoked: boolean; session_id: string }> {
    return this.delete(`/sessions/${encodeURIComponent(sessionId)}`);
  }

  // --- OAuth clients ---
  listClients(): Promise<HydraClient[]> {
    return this.get<HydraClient[]>("/clients");
  }

  getClient(clientId: string): Promise<HydraClient> {
    return this.get<HydraClient>(`/clients/${encodeURIComponent(clientId)}`);
  }

  createClient(value: ClientFormValue): Promise<HydraClient> {
    return this.post<HydraClient>("/clients", value);
  }

  updateClient(value: ClientFormValue): Promise<HydraClient> {
    return this.put<HydraClient>(`/clients/${encodeURIComponent(value.client_id)}`, value);
  }

  deleteClient(clientId: string): Promise<{ deleted: boolean; client_id: string }> {
    return this.delete(`/clients/${encodeURIComponent(clientId)}`);
  }

  listClientIdentityAccess(clientId: string): Promise<ClientAccessGrant[]> {
    return this.get<ClientAccessGrant[]>(`/clients/${encodeURIComponent(clientId)}/identities`);
  }
}

/** Extract a human-readable message from an admin-backend error response. */
export function describeError(e: unknown): string {
  const err = e as HttpErrorResponse;
  if (err && typeof err === "object" && "error" in err) {
    const body = (err as HttpErrorResponse).error as { error?: unknown } | string | undefined;
    if (body && typeof body === "object" && typeof body.error === "string") return body.error;
    if (typeof body === "string" && body) return body;
    if ((err as HttpErrorResponse).message) return (err as HttpErrorResponse).message;
  }
  return e instanceof Error ? e.message : "An unexpected error occurred";
}
