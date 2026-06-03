import { Component, computed, effect, inject, viewChild } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { TngToastComponent } from "@tailng-ui/components";
import { ProgressService } from "./core/progress/progress.service";
import type { AppToastTone } from "./core/toast/toast.model";
import { ToastService } from "./core/toast/toast.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, TngToastComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent {
  private readonly toastService = inject(ToastService);
  private readonly progressService = inject(ProgressService);

  protected readonly toast = viewChild<TngToastComponent>("toast");
  protected readonly showTopProgress = computed(() => this.progressService.isVisible());

  private lastShownToastId = 0;

  constructor() {
    effect(() => {
      const toast = this.toast();
      const events = this.toastService.events();

      if (!toast || events.length === 0) {
        return;
      }

      for (const event of events) {
        if (event.id <= this.lastShownToastId) {
          continue;
        }
        this.showToast(event.tone, event.message, {
          duration: event.duration,
          title: event.title,
        });
        this.lastShownToastId = event.id;
      }
    });
  }

  private showToast(
    tone: AppToastTone,
    message: string,
    options: { duration?: number; title?: string | null } = {},
  ): void {
    const toast = this.toast() as
      | {
          show?: (
            message: string,
            options?: { duration?: number; title?: string | null; tone?: AppToastTone },
          ) => void;
        }
      | undefined;
    if (!toast || typeof toast.show !== "function") {
      return;
    }
    toast.show(message, { ...options, tone });
  }
}
