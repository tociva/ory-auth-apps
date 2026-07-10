import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import {
  TngAvatarComponent,
  TngButtonComponent,
  TngMenuComponent,
  TngMenuTriggerFor,
  TngSelectComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { TngMenuGroupLabel, TngMenuItem, type TngMenuSelectEvent } from "@tailng-ui/primitives";
import { AppThemeService, THEME_OPTIONS, type AppThemeName } from "../../core/theme/app-theme.service";
import { SearchButtonComponent } from "../search/search-button.component";

@Component({
  selector: "app-admin-shell-header",
  standalone: true,
  imports: [
    TngAvatarComponent,
    TngButtonComponent,
    TngIcon,
    TngMenuComponent,
    TngMenuTriggerFor,
    TngMenuItem,
    TngMenuGroupLabel,
    TngSelectComponent,
    SearchButtonComponent,
  ],
  templateUrl: "./admin-shell-header.component.html",
  styleUrls: ["./admin-shell-header.component.css"],
})
export class AdminShellHeaderComponent {
  protected readonly themeService = inject(AppThemeService);
  protected readonly themeOptions = THEME_OPTIONS;

  @Input({ required: true }) drawerCollapsed = false;
  @Input({ required: true }) pageTitle = "";
  @Input({ required: true }) displayName = "";

  @Output() readonly drawerToggle = new EventEmitter<void>();
  @Output() readonly logout = new EventEmitter<void>();

  protected onProfileMenuSelect(event: TngMenuSelectEvent): void {
    if (String(event.value) === "logout") {
      this.logout.emit();
    }
  }

  protected onThemeChange(value: unknown): void {
    if (typeof value === "string") {
      this.themeService.setThemeName(value as AppThemeName);
    }
  }

  protected onModeChange(isDark: boolean): void {
    this.themeService.setDarkMode(isDark);
  }
}
