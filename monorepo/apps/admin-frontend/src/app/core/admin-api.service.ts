import { HttpClient, type HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { ADMIN_CONFIG } from "./admin-config";
import type {
  AdminIdentity,
  AdminMe,
  ClientFormValue,
  HydraClient,
  KratosSession,
} from "./admin-types";

/**
 * Client for admin-backend. Every call uses `withCredentials: true` so the
 * Kratos session cookie is forwarded; admin-backend enforces authorization on
 * each request (the UI is never the security boundary).
 */
@Injectable({ providedIn: "root" })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ADMIN_CONFIG);

  private base(): string {
    return `${this.config.adminBackendUrl}/admin`;
  }

  private get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base()}${path}`, { withCredentials: true }));
  }

  private post<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(
      this.http.post<T>(`${this.base()}${path}`, body, { withCredentials: true }),
    );
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(
      this.http.put<T>(`${this.base()}${path}`, body, { withCredentials: true }),
    );
  }

  private delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.base()}${path}`, { withCredentials: true }));
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

  createClient(value: ClientFormValue): Promise<HydraClient> {
    return this.post<HydraClient>("/clients", value);
  }

  updateClient(value: ClientFormValue): Promise<HydraClient> {
    return this.put<HydraClient>(`/clients/${encodeURIComponent(value.client_id)}`, value);
  }

  deleteClient(clientId: string): Promise<{ deleted: boolean; client_id: string }> {
    return this.delete(`/clients/${encodeURIComponent(clientId)}`);
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
