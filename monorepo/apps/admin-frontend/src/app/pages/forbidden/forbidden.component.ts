import { Component, inject } from "@angular/core";
import {
  TngButtonComponent,
  TngEmptyComponent,
  TngEmptyActionsComponent,
  TngEmptyDescriptionComponent,
  TngEmptyTitleComponent,
} from "@tailng-ui/components";
import { AdminAuthService } from "../../core/admin-auth.service";

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
  private readonly auth = inject(AdminAuthService);

  goSignIn(): void {
    void this.auth.signIn(window.location.origin);
  }

  goLogout(): void {
    void this.auth.signOut();
  }
}
