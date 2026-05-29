import { Component, input } from "@angular/core";
import { TngProgressSpinner } from "@tailng-ui/primitives";

/** TailNG progress-spinner primitive wrapped with a visible animated SVG. */
@Component({
  selector: "app-spinner",
  standalone: true,
  imports: [TngProgressSpinner],
  templateUrl: "./spinner.component.html",
  styleUrl: "./spinner.component.css",
})
export class SpinnerComponent {
  readonly label = input("Loading");
}
