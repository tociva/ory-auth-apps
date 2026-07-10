import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  TngAccordionComponent,
  TngAccordionItemComponent,
  TngAccordionPanelComponent,
  TngAccordionTriggerComponent,
  TngBadgeComponent,
  TngListboxComponent,
  TngSeparatorComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import type { AdminShellNavChild, AdminShellNavGroup } from "../admin-shell.types";

@Component({
  selector: "app-admin-shell-left-drawer",
  standalone: true,
  imports: [
    TngAccordionComponent,
    TngAccordionItemComponent,
    TngAccordionPanelComponent,
    TngAccordionTriggerComponent,
    TngBadgeComponent,
    TngIcon,
    TngListboxComponent,
    TngSeparatorComponent,
  ],
  templateUrl: "./admin-shell-left-drawer.component.html",
  styleUrls: ["./admin-shell-left-drawer.component.css"],
})
export class AdminShellLeftDrawerComponent {
  @Input({ required: true }) collapsed = false;
  @Input({ required: true }) navGroups: readonly AdminShellNavGroup[] = [];
  @Input({ required: true }) defaultExpandedGroups: readonly string[] = [];
  @Input({ required: true }) activeGroupPaths: ReadonlyMap<string, string | null> = new Map();

  @Output() readonly navSelect = new EventEmitter<string>();

  protected readonly getChildLabel = (child: AdminShellNavChild): string => child.label;
  protected readonly getChildValue = (child: AdminShellNavChild): string => child.path;

  protected onNavValueChange(value: unknown): void {
    if (typeof value === "string" && value.length > 0) {
      this.navSelect.emit(value);
    }
  }
}
