import { Component, DestroyRef, inject, type OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { AuthBrandDefinition, AuthBrandStatus } from "@idnest/shared-types";
import {
  TngBadgeComponent,
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
import { AdminApiService, describeError } from "../../../core/admin-api.service";
import type { AuthBrandRecord, AuthConfigurationVersion } from "../../../core/admin-types";
import { ToastService } from "../../../core/toast/toast.service";
import {
  FONT_FAMILY_OPTIONS,
  NEW_BRAND,
  STATUS_OPTIONS,
  getSelectLabel,
  getSelectValue,
  toMappingDraft,
  type MappingDraft,
} from "../authentication-page.types";

@Component({
  selector: "app-auth-brands",
  standalone: true,
  imports: [
    FormsModule,
    TngBadgeComponent,
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
  ],
  templateUrl: "./auth-brands.component.html",
  styleUrls: ["../authentication-page.css"],
})
export class AuthBrandsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private destroyed = false;

  brands: AuthBrandRecord[] = [];
  mappings: MappingDraft[] = [];
  loading = true;
  saving = false;
  error = "";

  brandId: string | null = null;
  brandVersion = 0;
  brandStatus: AuthBrandStatus = "draft";
  brand = structuredClone(NEW_BRAND);
  brandHistory: AuthConfigurationVersion<AuthBrandDefinition>[] = [];

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
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = "";
    try {
      const [brands, mappings] = await Promise.all([
        this.api.listAuthBrands(),
        this.api.listClientAuthConfigs(),
      ]);
      if (this.destroyed) return;
      this.brands = brands;
      this.mappings = mappings.map((mapping) => toMappingDraft(mapping));
    } catch (error) {
      if (this.destroyed) return;
      this.error = describeError(error);
      this.toast.danger(this.error);
    } finally {
      if (!this.destroyed) this.loading = false;
    }
  }

  selectBrand(record?: AuthBrandRecord): void {
    this.brandId = record?.id ?? null;
    this.brandVersion = record?.version ?? 0;
    this.brandStatus = record?.status ?? "draft";
    this.brand = structuredClone(record?.definition ?? NEW_BRAND);
    this.brandHistory = [];
    if (record) void this.loadBrandHistory(record.id);
  }

  duplicateSelectedBrand(): void {
    const source = this.brands.find((record) => record.id === this.brandId);
    if (!source) return;
    this.brandId = null;
    this.brandVersion = 0;
    this.brandStatus = "draft";
    this.brand = {
      ...structuredClone(source.definition),
      key: `${source.key}-copy`,
      displayName: `${source.definition.displayName} Copy`,
      productName: `${source.definition.productName} Copy`,
    };
  }

  async saveBrand(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      const saved = this.brandId
        ? await this.api.updateAuthBrand(
            this.brandId,
            this.brandVersion,
            this.brandStatus,
            this.brand,
            "Updated from authentication configuration",
          )
        : await this.api.createAuthBrand(
            this.brandStatus,
            this.brand,
            "Created from authentication configuration",
          );
      this.toast.success(`Saved ${saved.definition.productName}`);
      await this.reload();
      if (!this.destroyed) this.selectBrand(this.brands.find((brand) => brand.id === saved.id));
    } catch (error) {
      this.toast.danger(describeError(error));
    } finally {
      this.saving = false;
    }
  }

  async archiveBrand(record: AuthBrandRecord): Promise<void> {
    if (!window.confirm(`Archive the ${record.definition.productName} brand?`)) return;
    try {
      await this.api.archiveAuthBrand(record.id);
      this.toast.success("Brand archived");
      if (this.brandId === record.id) this.selectBrand();
      await this.reload();
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }

  archiveSelectedBrand(): void {
    const record = this.brands.find((brand) => brand.id === this.brandId);
    if (record) void this.archiveBrand(record);
  }

  clientsUsingBrand(brandId: string): number {
    return this.mappings.filter((mapping) => mapping.brandId === brandId).length;
  }

  private async loadBrandHistory(id: string): Promise<void> {
    try {
      const history = await this.api.listAuthBrandHistory(id);
      if (!this.destroyed && this.brandId === id) this.brandHistory = history;
    } catch (error) {
      this.toast.danger(describeError(error));
    }
  }
}
