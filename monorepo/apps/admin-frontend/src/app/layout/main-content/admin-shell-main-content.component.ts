import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-admin-shell-main-content",
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: "./admin-shell-main-content.component.html",
  styleUrls: ["./admin-shell-main-content.component.css"],
})
export class AdminShellMainContentComponent {}
