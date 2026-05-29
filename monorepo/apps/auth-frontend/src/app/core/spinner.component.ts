import { Component, input } from "@angular/core";
import { TngProgressSpinner } from "@tailng-ui/primitives";

/** TailNG progress-spinner primitive wrapped with a visible animated SVG. */
@Component({
  selector: "app-spinner",
  standalone: true,
  imports: [TngProgressSpinner],
  template: `
    <span
      tngProgressSpinner
      [indeterminate]="true"
      role="status"
      [attr.aria-label]="label()"
      class="inline-flex"
    >
      <svg
        class="animate-spin h-8 w-8 text-[#367588]"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
      </svg>
    </span>
  `,
})
export class SpinnerComponent {
  readonly label = input("Loading");
}
