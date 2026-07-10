import { Component, computed, DestroyRef, inject, signal, type OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import {
  TngAccordionComponent,
  TngAccordionItemComponent,
  TngAccordionPanelComponent,
  TngAccordionTriggerComponent,
  TngAvatarComponent,
  TngBadgeComponent,
  TngButtonComponent,
  TngListboxComponent,
  TngMenuComponent,
  TngMenuTriggerFor,
  TngSeparatorComponent,
  TngSelectComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { TngMenuItem, TngMenuGroupLabel, type TngMenuSelectEvent } from "@tailng-ui/primitives";
import { filter } from "rxjs";
import { AdminApiService } from "../core/admin-api.service";
import { ADMIN_CONFIG } from "../core/admin-config";
import { identityName } from "../core/admin-types";
import { AppThemeService, THEME_OPTIONS, type AppThemeName } from "../core/theme/app-theme.service";
import { SearchButtonComponent } from "./search/search-button.component";

type NavChild = Readonly<{ label: string; path: string }>;
type NavGroup = Readonly<{ label: string; subtitle: string; key: string; children: NavChild[] }>;

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    RouterOutlet,
    TngAccordionComponent,
    TngAccordionItemComponent,
    TngAccordionPanelComponent,
    TngAccordionTriggerComponent,
    TngAvatarComponent,
    TngBadgeComponent,
    TngButtonComponent,
    TngIcon,
    TngListboxComponent,
    TngMenuComponent,
    TngMenuTriggerFor,
    TngMenuItem,
    TngMenuGroupLabel,
    TngSeparatorComponent,
    TngSelectComponent,
    SearchButtonComponent,
  ],
  templateUrl: "./shell.component.html",
  styleUrls: ["./shell.component.css"],
})
export class ShellComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly config = inject(ADMIN_CONFIG);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly themeService = inject(AppThemeService);
  private destroyed = false;

  protected readonly themeOptions = THEME_OPTIONS;

  readonly navGroups: readonly NavGroup[] = [
    {
      key: "identities-access",
      label: "Identities & Access",
      subtitle: "Users, roles, and OAuth clients",
      children: [
        { label: "Identities", path: "/identities" },
        { label: "OAuth Clients", path: "/clients" },
      ],
    },
  ];

  private readonly currentUrl = signal(this.router.url);

  protected readonly activeGroupPaths = computed(() => {
    const map = new Map<string, string | null>();
    const url = this.currentUrl().split(/[?#]/)[0] ?? "";
    for (const group of this.navGroups) {
      const active = group.children.find(
        (c) => url === c.path || url.startsWith(`${c.path}/`),
      );
      map.set(group.key, active?.path ?? null);
    }
    return map;
  });

  protected readonly defaultExpandedGroups = this.navGroups.map((g) => g.key);

  drawerCollapsed = false;
  displayName = "";
  pageTitle = "Identities";

  protected readonly getChildLabel = (child: NavChild): string => child.label;
  protected readonly getChildValue = (child: NavChild): string => child.path;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  async ngOnInit(): Promise<void> {
    this.syncPageTitle();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects);
        this.syncPageTitle();
      });

    try {
      const me = await this.api.me();
      await this.setDisplayNameAfterCurrentCheck(identityName(me.identity) || me.email);
    } catch {
      // Guard already gated entry; ignore transient failure.
    }
  }

  toggleDrawer(): void {
    this.drawerCollapsed = !this.drawerCollapsed;
  }

  signOut(): void {
    const logoutUrl = this.config.authLoginUrl.replace(/\/login\/?$/, "/logout");
    const returnTo = encodeURIComponent(window.location.origin);
    window.location.href = `${logoutUrl}?return_to=${returnTo}`;
  }

  protected onProfileMenuSelect(event: TngMenuSelectEvent): void {
    if (String(event.value) === "logout") {
      this.signOut();
    }
  }

  protected onNavValueChange(value: unknown): void {
    if (typeof value !== "string" || value.length === 0) return;
    void this.router.navigateByUrl(value);
  }

  protected onThemeChange(value: unknown): void {
    if (typeof value === "string") {
      this.themeService.setThemeName(value as AppThemeName);
    }
  }

  protected onModeChange(isDark: boolean): void {
    this.themeService.setDarkMode(isDark);
  }

  private syncPageTitle(): void {
    const path = this.router.url.split("?")[0] ?? "";
    if (path.startsWith("/clients")) {
      this.pageTitle = "OAuth Clients";
      return;
    }
    if (path.startsWith("/identities/")) {
      this.pageTitle = "Identity Detail";
      return;
    }
    this.pageTitle = "Identities";
  }

  private async setDisplayNameAfterCurrentCheck(displayName: string): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (!this.destroyed) {
      this.displayName = displayName;
    }
  }
}
