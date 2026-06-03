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
  templateUrl: "./forbidden.component.html",
  styleUrls: ["./forbidden.component.css"],
})
export class ForbiddenComponent {
  private readonly config = inject(ADMIN_CONFIG);

  goSignIn(): void {
    window.location.href = this.config.authLoginUrl;
  }
}
