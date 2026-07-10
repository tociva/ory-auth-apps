import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { TngButtonComponent } from "@tailng-ui/components";
import { AdminApiService, describeError } from "../../core/admin-api.service";
import type { HydraClient } from "../../core/admin-types";
import { ToastService } from "../../core/toast/toast.service";

@Component({
  selector: "app-clients",
  standalone: true,
  imports: [RouterLink, TngButtonComponent],
  templateUrl: "./clients.component.html",
  styleUrls: ["./clients.component.css"],
})
export class ClientsComponent implements OnInit {
  private static readonly interactiveTargetSelector = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']",
    "[role='button']",
    "[role='link']",
  ].join(",");

  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly clientSorter = new Intl.Collator(undefined, { sensitivity: "base" });
  private destroyed = false;
  private loadRequestId = 0;

  rows: HydraClient[] = [];
  loading = true;
  error = "";

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.error = "";
    try {
      const rows = await this.api.listClients();
      if (!this.isActiveLoad(requestId)) return;
      this.rows = this.sortClients(rows);
    } catch (e) {
      const error = describeError(e);
      if (!this.isActiveLoad(requestId)) return;
      this.error = error;
      this.toast.danger(error);
    } finally {
      if (this.isActiveLoad(requestId)) {
        this.loading = false;
      }
    }
  }

  authMethodLabel(client: HydraClient): string {
    switch (client.token_endpoint_auth_method) {
      case "none":
        return "Public (PKCE)";
      case "client_secret_basic":
        return "Secret basic";
      case "client_secret_post":
        return "Secret post";
      case "private_key_jwt":
        return "Private key JWT";
      default:
        return client.token_endpoint_auth_method?.trim() || "Not set";
    }
  }

  clientLabel(client: HydraClient): string {
    const clientId = client.client_id.trim();
    const clientName = client.client_name?.trim();
    return clientName && clientName !== clientId ? `${clientName} (${clientId})` : clientId;
  }

  redirectUriSummary(client: HydraClient): string {
    const redirectUris = client.redirect_uris ?? [];
    if (redirectUris.length === 0) return "No redirect URIs";
    if (redirectUris.length === 1) return redirectUris[0] ?? "";
    return `${redirectUris.length} redirect URIs`;
  }

  redirectUriTitle(client: HydraClient): string | null {
    const redirectUris = client.redirect_uris ?? [];
    return redirectUris.length > 0 ? redirectUris.join("\n") : null;
  }

  scopeSummary(client: HydraClient): string {
    return client.scope?.trim() || "No scopes";
  }

  openClientFromPointer(event: MouseEvent, client: HydraClient): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      this.eventStartedInInteractiveChild(event)
    ) {
      return;
    }

    void this.navigateToClient(client);
  }

  private async navigateToClient(client: HydraClient): Promise<void> {
    const clientId = client.client_id.trim();
    if (!clientId) return;
    await this.router.navigate(["/clients", clientId]);
  }

  private eventStartedInInteractiveChild(event: Event): boolean {
    const target = event.target;
    const currentTarget = event.currentTarget;
    if (!(target instanceof Element) || !(currentTarget instanceof Element)) return false;

    const interactiveTarget = target.closest(ClientsComponent.interactiveTargetSelector);
    return (
      interactiveTarget !== null &&
      interactiveTarget !== currentTarget &&
      currentTarget.contains(interactiveTarget)
    );
  }

  private isActiveLoad(requestId: number): boolean {
    return !this.destroyed && requestId === this.loadRequestId;
  }

  private sortClients(rows: HydraClient[]): HydraClient[] {
    return [...rows].sort((a, b) => this.clientSorter.compare(a.client_id, b.client_id));
  }
}
