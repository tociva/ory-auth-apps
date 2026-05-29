import { Component, inject } from "@angular/core";
import {
  TngButtonComponent,
  TngEmptyComponent,
  TngEmptyActionsComponent,
  TngEmptyDescriptionComponent,
  TngEmptyTitleComponent,
} from "@tailng-ui/components";
import { ADMIN_CONFIG } from "../../core/admin-config";

@Component({
  selector: "app-forbidden",
  standalone: true,
  imports: [
    TngButtonComponent,
    TngEmptyComponent,
    TngEmptyActionsComponent,
    TngEmptyDescriptionComponent,
    TngEmptyTitleComponent,
  ],
  template: `
    <div class="center-screen">
      <tng-empty>
        <tng-empty-title>Not authorized</tng-empty-title>
        <tng-empty-description>
          Your account is signed in but doesn't have admin access. Ask an existing
          administrator to grant your account the admin role.
        </tng-empty-description>
        <tng-empty-actions>
          <tng-button appearance="solid" tone="primary" (click)="goSignIn()">
            Sign in as a different user
          </tng-button>
        </tng-empty-actions>
      </tng-empty>
    </div>
  `,
})
export class ForbiddenComponent {
  private readonly config = inject(ADMIN_CONFIG);

  goSignIn(): void {
    window.location.href = this.config.authLoginUrl;
  }
}
