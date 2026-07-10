import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  TngListboxComponent,
  TngSeparatorComponent,
  TngTooltipComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import type { AdminShellNavChild, AdminShellNavGroup } from "../admin-shell.types";

@Component({
  selector: "app-admin-shell-left-drawer",
  standalone: true,
  imports: [
    TngIcon,
    TngListboxComponent,
    TngSeparatorComponent,
    TngTooltipComponent,
  ],
  templateUrl: "./admin-shell-left-drawer.component.html",
  styleUrls: ["./admin-shell-left-drawer.component.css"],
})
export class AdminShellLeftDrawerComponent {
  @Input({ required: true }) collapsed = false;
  @Input({ required: true }) navGroups: readonly AdminShellNavGroup[] = [];
  @Input({ required: true }) activePath: string | null = null;

  @Output() readonly navSelect = new EventEmitter<string>();

  protected get navItems(): readonly AdminShellNavChild[] {
    return this.navGroups.flatMap((group) => group.children);
  }

  protected readonly getChildLabel = (child: AdminShellNavChild): string => child.label;
  protected readonly getChildValue = (child: AdminShellNavChild): string => child.path;

  protected onNavValueChange(value: unknown): void {
    if (typeof value === "string" && value.length > 0) {
      this.navSelect.emit(value);
    }
  }
}
