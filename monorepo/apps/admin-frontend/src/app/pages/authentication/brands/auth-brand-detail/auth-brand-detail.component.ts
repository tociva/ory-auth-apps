import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import type { AuthBrandDefinition, AuthBrandStatus } from "@idnest/shared-types";
import {
  TngButtonComponent,
  TngCardComponent,
  TngCardContentComponent,
  TngCardDescriptionComponent,
  TngCardHeaderComponent,
  TngCardTitleComponent,
  TngCollapsibleComponent,
  TngFormFieldComponent,
  TngInputAngularFormsAdapter,
  TngInputComponent,
  TngLabelComponent,
  TngProgressSpinnerComponent,
  TngSelectComponent,
} from "@tailng-ui/components";
import { TngIcon } from "@tailng-ui/icons";
import { AdminApiService, describeError } from "../../../../core/admin-api.service";
import type { AuthConfigurationVersion } from "../../../../core/admin-types";
import { ToastService } from "../../../../core/toast/toast.service";
import {
  FONT_FAMILY_OPTIONS,
  NEW_BRAND,
  STATUS_OPTIONS,
  getSelectLabel,
  getSelectValue,
} from "../../authentication-page.types";

@Component({
  selector: "app-auth-brand-detail",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TngButtonComponent,
    TngCardComponent,
    TngCardContentComponent,
    TngCardDescriptionComponent,
    TngCardHeaderComponent,
    TngCardTitleComponent,
    TngCollapsibleComponent,
    TngFormFieldComponent,
    TngIcon,
    TngInputAngularFormsAdapter,
    TngInputComponent,
    TngLabelComponent,
    TngProgressSpinnerComponent,
    TngSelectComponent,
  ],
  templateUrl: "./auth-brand-detail.component.html",
  styleUrls: ["../../authentication-page.css"],
})
export class AuthBrandDetailComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private destroyed = false;
  private brandId = "";

  brandVersion = 0;
  brandStatus: AuthBrandStatus = "draft";
  brand = structuredClone(NEW_BRAND);
  brandHistory: AuthConfigurationVersion<AuthBrandDefinition>[] = [];
  createMode = true;
  loading = true;
  saving = false;
  error = "";
  notice = "";

  readonly statusOptions = STATUS_OPTIONS;
  readonly fontFamilyOptions = FONT_FAMILY_OPTIONS;
  readonly getSelectValue = getSelectValue;
  readonly getSelectLabel = getSelectLabel;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  ngOnInit(): void {
    this.brandId = this.route.snapshot.paramMap.get("id") ?? "";
    this.createMode = !this.brandId;
    void this.load();
  }

  brandDisplayName(): string {
    return (
      this.brand.productName.trim() || (this.createMode ? "New brand" : "Auth brand")
    );
  }

  async saveBrand(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.error = "";
    this.notice = "";
    const wasCreate = this.createMode;
    try {
      const saved = this.createMode
        ? await this.api.createAuthBrand(
            this.brandStatus,
            this.brand,
            "Created from authentication configuration",
          )
        : await this.api.updateAuthBrand(
            this.brandId,
            this.brandVersion,
            this.brandStatus,
            this.brand,
            "Updated from authentication configuration",
          );
      if (this.destroyed) return;

      this.toast.success(`Saved ${saved.definition.productName}`);
      this.brandId = saved.id;
      this.brandVersion = saved.version;
      this.brandStatus = saved.status;
      this.brand = structuredClone(saved.definition);
      this.createMode = false;

      if (wasCreate) {
        await this.router.navigate(["/authentication/brands", saved.id], {
          replaceUrl: true,
        });
        return;
      }

      this.notice = `Brand ${saved.definition.productName} saved.`;
      this.brandHistory = await this.safeHistory(saved.id);
    } catch (error) {
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.saving = false;
    }
  }

  async archiveBrand(): Promise<void> {
    if (this.createMode || !this.brandId) return;
    if (!window.confirm(`Archive the ${this.brand.productName || "selected"} brand?`)) return;
    this.saving = true;
    this.error = "";
    try {
      await this.api.archiveAuthBrand(this.brandId);
      this.toast.success("Brand archived");
      await this.router.navigate(["/authentication/brands"]);
    } catch (error) {
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.saving = false;
    }
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      if (this.createMode) {
        this.applyDuplicateState();
        return;
      }

      const brands = await this.api.listAuthBrands();
      if (this.destroyed) return;
      const record = brands.find((brand) => brand.id === this.brandId);
      if (!record) {
        this.error = "Auth brand not found";
        this.toast.danger(this.error);
        return;
      }

      this.brandVersion = record.version;
      this.brandStatus = record.status;
      this.brand = structuredClone(record.definition);
      this.brandHistory = await this.safeHistory(record.id);
    } catch (error) {
      if (this.destroyed) return;
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.loading = false;
    }
  }

  private applyDuplicateState(): void {
    const state = window.history.state as { duplicate?: unknown };
    const duplicate = state.duplicate;
    if (duplicate && typeof duplicate === "object") {
      this.brand = structuredClone(duplicate as AuthBrandDefinition);
      this.brandStatus = "draft";
      this.brandVersion = 0;
      const nextState = { ...state };
      delete nextState.duplicate;
      window.history.replaceState(nextState, "", window.location.href);
    } else {
      this.brand = structuredClone(NEW_BRAND);
      this.brandStatus = "draft";
      this.brandVersion = 0;
    }
  }

  private async safeHistory(
    id: string,
  ): Promise<AuthConfigurationVersion<AuthBrandDefinition>[]> {
    try {
      return await this.api.listAuthBrandHistory(id);
    } catch {
      return [];
    }
  }
}
