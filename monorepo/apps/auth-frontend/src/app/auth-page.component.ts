import { DOCUMENT, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import type { KratosFlow, KratosUiNode, KratosUiText, PublicAuthContext } from "@idnest/shared-types";
import { AuthApiService } from "./auth-api.service";
import { BrandService } from "./brand.service";

@Component({
  selector: "idnest-auth-page",
  template: `
    <div class="auth-page">
      <main class="auth-card" aria-live="polite">
        @if (loading()) {
          <div class="loading-state" role="status">
            <span class="spinner" aria-hidden="true"></span>
            <span>Preparing secure sign-in…</span>
          </div>
        } @else if (error()) {
          <section class="error-state">
            <div class="brand-mark" aria-hidden="true">I</div>
            <h1>Sign-in unavailable</h1>
            <p>{{ error() }}</p>
          </section>
        } @else if (flow() && context()) {
          <header class="brand-header">
            @if (brandLogo() && !logoFailed()) {
              <picture>
                @if (darkBrandLogo()) {
                  <source media="(prefers-color-scheme: dark)" [srcset]="darkBrandLogo()" />
                }
                <img
                  class="brand-logo"
                  [src]="brandLogo()"
                  [alt]="context()!.brand.displayName"
                  (error)="logoFailed.set(true)"
                />
              </picture>
            } @else {
              <div class="brand-wordmark">
                <span class="brand-mark" aria-hidden="true">{{ brandInitial() }}</span>
                <strong>{{ context()!.brand.productName }}</strong>
              </div>
            }
            <h1>{{ context()!.brand.loginHeading }}</h1>
            <p>{{ context()!.brand.loginDescription }}</p>
          </header>

          @if (flow()!.ui.messages?.length) {
            <div class="flow-messages" role="alert">
              @for (message of flow()!.ui.messages; track message.id ?? $index) {
                <p [class.message-error]="message.type === 'error'">{{ message.text }}</p>
              }
            </div>
          }

          @if (illustrationUrl()) {
            <img class="brand-illustration" [src]="illustrationUrl()" alt="" />
          }

          @if (enrollmentUrl() && !hasInteractiveNodes()) {
            <section class="enrollment-state">
              <p>
                This application requires a second authentication factor. Set up an
                authenticator app, then continue sign-in.
              </p>
              <a class="auth-button" [href]="enrollmentUrl()">Set up authenticator</a>
            </section>
          } @else {
            <form
              class="auth-form"
              [attr.action]="flow()!.ui.action"
              [attr.method]="flow()!.ui.method"
            >
              @for (node of flow()!.ui.nodes; track nodeKey(node, $index)) {
                @if (isHidden(node)) {
                  <input
                    type="hidden"
                    [attr.name]="node.attributes.name"
                    [attr.value]="nodeValue(node)"
                  />
                } @else if (isSubmit(node)) {
                  <button
                    class="auth-button"
                    [class.provider-button]="node.group === 'oidc'"
                    type="submit"
                    [attr.name]="node.attributes.name"
                    [attr.value]="nodeValue(node)"
                    [disabled]="node.attributes.disabled === true"
                  >
                    @if (node.group === "oidc") {
                      <span class="provider-dot" aria-hidden="true"></span>
                    }
                    {{ nodeLabel(node) }}
                  </button>
                  <ng-container
                    [ngTemplateOutlet]="messages"
                    [ngTemplateOutletContext]="{ values: node.messages ?? [], messageId: null }"
                  />
                } @else if (isInput(node)) {
                  <label class="auth-field" [attr.for]="nodeInputId($index)">
                    <span>{{ nodeLabel(node) }}</span>
                    <input
                      [attr.id]="nodeInputId($index)"
                      [attr.type]="inputType(node)"
                      [attr.name]="node.attributes.name"
                      [attr.value]="nodeValue(node)"
                      [attr.autocomplete]="node.attributes.autocomplete ?? null"
                      [required]="node.attributes.required === true"
                      [disabled]="node.attributes.disabled === true"
                      [attr.aria-invalid]="hasErrors(node) ? 'true' : null"
                      [attr.aria-describedby]="
                        node.messages?.length ? nodeMessageId($index) : null
                      "
                      [checked]="
                        (inputType(node) === 'checkbox' || inputType(node) === 'radio') &&
                        node.attributes.value === true
                      "
                    />
                  </label>
                  <ng-container
                    [ngTemplateOutlet]="messages"
                    [ngTemplateOutletContext]="{
                      values: node.messages ?? [],
                      messageId: nodeMessageId($index)
                    }"
                  />
                }
              }
            </form>
          }

          <button type="button" class="cancel-link" [disabled]="cancelling()" (click)="cancel()">
            {{ isSettingsReauth() ? "Back to settings" : "Cancel and return" }}
          </button>

          <footer class="legal-footer">
            @if (context()!.brand.supportUrl) {
              <a [href]="context()!.brand.supportUrl">Support</a>
            }
            @if (context()!.brand.privacyUrl) {
              <a [href]="context()!.brand.privacyUrl">Privacy</a>
            }
            @if (context()!.brand.termsUrl) {
              <a [href]="context()!.brand.termsUrl">Terms</a>
            }
          </footer>
        }
      </main>
    </div>

    <ng-template #messages let-values="values" let-messageId="messageId">
      <div [attr.id]="messageId">
        @for (message of asMessages(values); track message.id ?? $index) {
          <p class="field-message" [class.message-error]="message.type === 'error'">
            {{ message.text }}
          </p>
        }
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AuthApiService);
  private readonly brands = inject(BrandService);
  private readonly document = inject(DOCUMENT);

  readonly loading = signal(true);
  readonly cancelling = signal(false);
  readonly error = signal("");
  readonly flow = signal<KratosFlow | null>(null);
  readonly context = signal<PublicAuthContext | null>(null);
  readonly logoFailed = signal(false);

  async ngOnInit(): Promise<void> {
    const flowId = this.route.snapshot.queryParamMap.get("flow");
    if (!flowId) {
      this.loading.set(false);
      this.error.set("This sign-in link is incomplete. Return to the application and try again.");
      return;
    }
    try {
      const response = await this.api.loginFlowContext(flowId);
      this.flow.set(response.flow);
      this.context.set(response.context);
      this.brands.apply(response.context.brand);
      window.setTimeout(() => {
        const firstInvalid = this.document.querySelector<HTMLElement>('[aria-invalid="true"]');
        firstInvalid?.focus();
      });
    } catch {
      this.error.set("This sign-in request has expired or could not be loaded.");
    } finally {
      this.loading.set(false);
    }
  }

  brandLogo(): string {
    const brand = this.context()?.brand;
    return brand?.logoLightUrl || brand?.logoCompactUrl || "";
  }

  darkBrandLogo(): string {
    return this.context()?.brand.logoDarkUrl || "";
  }

  illustrationUrl(): string {
    return this.brands.safeAssetUrl(this.context()?.brand.illustrationUrl);
  }

  enrollmentUrl(): string {
    return this.context()?.secondaryFactorEnrollmentUrl || "";
  }

  isSettingsReauth(): boolean {
    return this.context()?.purpose === "settings_reauth";
  }

  hasInteractiveNodes(): boolean {
    return (this.flow()?.ui.nodes ?? []).some(
      (node) => this.isSubmit(node) || this.isInput(node),
    );
  }

  brandInitial(): string {
    return this.context()?.brand.productName.trim().charAt(0).toUpperCase() || "I";
  }

  nodeKey(node: KratosUiNode, index: number): string {
    return `${node.group}:${node.attributes.name ?? node.type}:${String(node.attributes.value ?? "")}:${index}`;
  }

  nodeInputId(index: number): string {
    return `kratos-node-${index}`;
  }

  nodeMessageId(index: number): string {
    return `kratos-node-${index}-messages`;
  }

  nodeValue(node: KratosUiNode): string {
    const value = node.attributes.value;
    return typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
      ? String(value)
      : "";
  }

  nodeLabel(node: KratosUiNode): string {
    return node.meta?.label?.text || (
      node.attributes.name === "provider"
        ? `Continue with ${this.nodeValue(node)}`
        : this.nodeValue(node) || node.attributes.name || "Continue"
    );
  }

  isHidden(node: KratosUiNode): boolean {
    return node.attributes.type === "hidden";
  }

  isSubmit(node: KratosUiNode): boolean {
    return node.attributes.type === "submit";
  }

  isInput(node: KratosUiNode): boolean {
    return node.type === "input" && !this.isHidden(node) && !this.isSubmit(node);
  }

  inputType(node: KratosUiNode): string {
    const type = node.attributes.type;
    return ["email", "password", "text", "tel", "number", "checkbox", "radio"].includes(type ?? "")
      ? String(type)
      : "text";
  }

  hasErrors(node: KratosUiNode): boolean {
    return (node.messages ?? []).some((message) => message.type === "error");
  }

  asMessages(value: unknown): KratosUiText[] {
    return Array.isArray(value) ? value as KratosUiText[] : [];
  }

  async cancel(): Promise<void> {
    if (this.cancelling()) return;
    if (this.isSettingsReauth()) {
      window.location.assign(this.context()?.settingsResumeUrl || "/settings");
      return;
    }
    const transactionId = this.context()?.transactionId;
    if (!transactionId) return;
    this.cancelling.set(true);
    try {
      const response = await this.api.rejectLogin(transactionId);
      window.location.assign(response.redirectTo);
    } catch {
      this.error.set("Unable to cancel this sign-in request safely.");
      this.cancelling.set(false);
    }
  }
}
