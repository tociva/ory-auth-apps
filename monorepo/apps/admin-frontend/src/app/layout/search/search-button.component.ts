import { DOCUMENT } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { TngButtonComponent, TngCommandPaletteComponent } from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { fromEvent } from "rxjs";
import { isMacPlatform } from "../../core/system/platform.utils";
import { SearchIndexService } from "./search-index.service";

@Component({
  selector: "app-search-button",
  standalone: true,
  imports: [TngButtonComponent, TngCommandPaletteComponent, TngIcon],
  templateUrl: "./search-button.component.html",
  styleUrls: ["./search-button.component.css"],
})
export class SearchButtonComponent {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly index = toSignal(inject(SearchIndexService).index$, { initialValue: null });

  protected readonly searchShortcutHint = isMacPlatform() ? "⌘K" : "Ctrl K";
  protected readonly open = signal(false);
  protected readonly query = signal("");

  protected readonly results = computed(() => {
    const index = this.index();
    if (!index) return [];

    const q = this.query().trim();
    const entries = q ? index.fuse.search(q).map((r) => r.item) : index.entries;

    return entries.map((entry) => ({
      label: entry.title,
      description: entry.description,
      value: entry.url,
    }));
  });

  constructor() {
    fromEvent<KeyboardEvent>(this.document, "keydown")
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.onDocumentKeydown(event));
  }

  protected openPalette(initialQuery = ""): void {
    this.query.set(initialQuery);
    this.open.set(true);
  }

  protected onSearchBtnKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) {
      return;
    }
    if (event.key.length === 1 && event.key.trim().length === 1) {
      event.preventDefault();
      this.openPalette(event.key);
    }
  }

  private onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.openPalette("");
    }
  }

  protected onOptionSelect(event: { option: { label: string; value?: string } }): void {
    const url = event.option.value;
    if (url) {
      this.open.set(false);
      void this.router.navigateByUrl(url);
    }
  }
}
