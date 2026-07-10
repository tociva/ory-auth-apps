# Admin-Frontend ↔ Daybook Alignment Plan

Bring the **admin-frontend** Angular app (`monorepo/apps/admin-frontend`) in line with the
**daybook-cloud-frontend** reference app (currently in `temp/`) for the requested features.

## Context

Both apps are **Angular 21** and both use **TailNG UI** (`@tailng-ui/*`) at *identical*
versions (`components 0.71.0`, `theme 0.49.0`, `icons 0.14.0`, `primitives 0.60.0`, `cdk 0.43.0`).
That means every TailNG component and theme preset used by daybook is already available to
admin-frontend — the work is wiring, not new dependencies (except `fuse.js` for search).

Key difference to respect: **daybook's stores use `@ngrx/signals`**. Requirement #2 says *don't use
ngrx-store*, so each daybook store is re-implemented in admin-frontend as a **plain Angular
`signal()`-based `@Injectable({ providedIn: 'root' })` service** with the same public API
(`show`/`success`/`danger`, `show`/`hide`, theme methods). Admin-frontend ends up with **no ngrx
dependency at all**.

Admin-frontend today: a single `ShellComponent` (drawer + header), `AdminApiService` using
`firstValueFrom` directly, a single custom theme via `provideTailngTheme`, plain `<a>` nav links,
and a basic "email + Sign out" header.

---

## Requirement-by-requirement plan

### 1. Use the same font (Roboto, self-hosted)
- Copy `temp/public/assets/fonts/roboto/*.woff2` → `apps/admin-frontend/public/assets/fonts/roboto/`.
- Add `apps/admin-frontend/src/styles/fonts.css` (the 18 `@font-face` blocks from daybook).
- In `apps/admin-frontend/src/styles.css`: `@import './styles/fonts.css';` and set
  `font-family: 'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif;` on `html, body`
  (replacing the current `system-ui` stack).
- `project.json` already globs `public/**/*` into assets, so no build-config change needed for fonts.

### 2. Do **not** use ngrx-store
- Implement all new state as plain signal services (see Toast/Progress/Theme below). No
  `@ngrx/store` or `@ngrx/signals` added to `package.json`.

### 3 + 4. Header: name + profile picture → click opens menu with Logout
- Replace the current `header-actions` block in `shell.component.html`.
- Use `<tng-avatar [fallback]="displayName()">` as the profile picture (initials avatar; Kratos has
  no uploaded photo, so fallback initials match daybook's behavior).
- Wrap the avatar + name in a `<button [tngMenuTriggerFor]="profileMenu">` trigger and add a
  `<tng-menu #profileMenu="tngMenu" (tngMenuSelect)="onProfileMenuSelect($event)">` containing a
  **Logout** item (`tngMenuItem tngMenuItemValue="logout"`), reusing the existing `signOut()` logic.
- `displayName()`: derive from `AdminMe.identity.traits.name` (fall back to `email`). The shell
  already loads `me` in `ngOnInit`; extend it to also store name.
- Imports to add: `TngMenuComponent`, `TngMenuTriggerFor` (`@tailng-ui/components`),
  `TngMenuItem`, `TngMenuGroupLabel`, `TngMenuSelectEvent` (`@tailng-ui/primitives`).

### 5. Left drawer menus via `tng-listbox`
- Restructure the drawer nav to daybook's pattern: a `<tng-accordion type="multiple">` whose items
  wrap a `<tng-listbox>` per group.
- Admin has only two destinations today (Identities, OAuth Clients). Recommend grouping them under
  a single "Administration" group (or two thin groups) so the listbox pattern reads naturally:
  - Group **Identities & Access** → listbox options: *Identities*, *OAuth Clients*.
- Reuse daybook's `getOptionValue`/`getOptionLabel`/`valueChange → router.navigateByUrl` wiring and
  the active-selection computed map (`activeGroupPaths`).
- Imports: `TngListboxComponent`, `TngAccordionComponent`, `TngAccordionItemComponent`,
  `TngAccordionPanelComponent`, `TngAccordionTriggerComponent`.
- Keep the existing collapse/responsive CSS; adapt selectors to the accordion/listbox markup.

### 6. Header: mode + theme selection
- Port daybook's `AppThemeStore` as a plain signal service `core/theme/app-theme.service.ts`:
  - State: `darkMode: signal<boolean>`, `themeName: signal<AppThemeName>`.
  - `THEME_OPTIONS` + `THEME_PRESETS` map (same 8 presets from `@tailng-ui/theme`).
  - `effect()` calling `applyTailngTheme(dark ? preset.dark : preset.light)`.
  - localStorage persistence under key `admin:theme` (read on init for correct first paint).
- In `app.config.ts`: drop the single `provideTailngTheme({ theme: idnestTheme })` and instead let
  the service own theming (initialize the service at app start). Preserve the idnest brand accent
  (`#367588`) — set it as the default/override or pick the closest preset (`atlas` is teal-led).
  *Decision needed: keep idnest teal as a custom override vs. adopt a daybook preset (recommend
  keeping teal accent).*
- Add two controls to the header `header-actions`:
  - **Mode**: `tng-button-toggle-group` (Light/Dark) or a `tng-switch`, calling `setDarkMode()`.
  - **Theme**: `tng-select` bound to `THEME_OPTIONS`, calling `setThemeName()`.
- Persist immediately on change (header has no save button, unlike daybook's profile form).

### 7. Toast messages (as in daybook)
- Add `core/toast/toast.model.ts` (`AppToastTone`, `AppToastOptions`, `AppToastEvent`) and
  `core/toast/toast.service.ts` — a signal service with `events` signal + `nextId`, and methods
  `show/success/warning/danger/neutral/clear` (same API as daybook's `ToastStore`).
- In `app.component.html`: add `<tng-toast #toast position="bottom-right" />`.
- In `app.component.ts`: `viewChild<TngToastComponent>('toast')` + an `effect` that replays new
  events into `toast.show(message, { tone, duration, title })`, tracking `lastShownToastId`
  (identical to daybook's `App`).
- Wire real usage: have `AdminApiService` / page components call `toast.danger(describeError(e))`
  on failures and `toast.success(...)` on mutations (create/update/delete client, deactivate/delete
  identity, revoke sessions).

### 8. Top loading indicator (as in daybook)
- Add `core/progress/progress.service.ts` — signal service with `activeRequests` count and
  `isVisible` computed; methods `show/hideOne/hide`.
- In `app.component.html`: add the top bar markup
  `@if (showTopProgress()) { <div class="app-top-progress"><span class="app-top-progress__bar"></span></div> }`
  and copy the `.app-top-progress` CSS + keyframes from daybook's `app.css`.
- Drive it from HTTP. Two options:
  - **(Recommended)** Wrap calls in `AdminApiService` with a `withProgress()` helper
    (show before, `hideOne()` in `finally`) — mirrors daybook's `ApiClientService`.
  - Or add an `HttpInterceptorFn` that increments/decrements around every request (more global; also
    fine since admin uses `provideHttpClient`).

### 9. CTRL+K command palette search
- Add `fuse.js` to `monorepo` dependencies (daybook uses `fuse.js ^7.3.0`).
- Port `SearchIndexService` (loads `/assets/search/index.json`, builds Fuse index) and
  `WorkspaceSearchButtonComponent` (button + `<tng-command-palette>` + global `keydown`
  Cmd/Ctrl+K handler) into `app/layout/` (e.g. `layout/search/`).
- Port `core/system/platform.utils.ts` (`isMacPlatform`) for the `⌘K` / `Ctrl K` hint.
- Create `apps/admin-frontend/public/assets/search/index.json` with admin entries:
  *Identities*, *OAuth Clients* (navigation), and quick actions as desired (e.g. *New OAuth client*).
  *Decision needed (req scope): nav-only vs. also indexing live identities/clients.* Static nav +
  actions index is the daybook-faithful baseline; live record search would need an API-backed index.
- Place `<app-search-button />` in the header (between title and actions, as daybook does).

### 10. *(left blank in the request — nothing to implement unless specified)*

---

## File-change summary

**New files (admin-frontend `src/`):**
- `styles/fonts.css`
- `core/toast/{toast.model.ts, toast.service.ts}`
- `core/progress/progress.service.ts`
- `core/theme/app-theme.service.ts`
- `core/system/platform.utils.ts`
- `layout/search/{search-button.component.ts,.html,.css}` + `layout/search/search-index.service.ts`

**Edited files:**
- `styles.css` (font import + family)
- `app.config.ts` (theme service init; keep brand accent)
- `app.component.{ts,html,css}` (toast outlet, top progress bar + effects)
- `layout/shell.component.{ts,html,css}` (profile menu, theme/mode controls, accordion+listbox nav, search button)
- `core/admin-api.service.ts` (progress wrapping + toast on success/error)
- `package.json` (add `fuse.js`)

**New assets (admin-frontend `public/`):**
- `assets/fonts/roboto/*.woff2`
- `assets/search/index.json`

---

## Verification step
- `pnpm nx run admin-frontend:typecheck` and `:lint` must pass.
- `pnpm nx serve admin-frontend` (port 4501) and manually verify: Roboto renders; toast appears on
  a create/error; top bar shows during API calls; theme + mode switch and persist across reload;
  drawer listbox navigates and reflects active route; profile menu opens and logs out; Cmd/Ctrl+K
  opens the palette and navigates.
- Confirm `package.json` contains **no** `@ngrx/*` entry.

## Open decisions (please confirm before build)
1. **Theme default/accent**: keep idnest teal (`#367588`) as a custom override, or adopt a daybook
   preset like `atlas`? (Recommend: keep teal.)
2. **Drawer grouping**: single "Identities & Access" accordion group for the two items, or two
   groups? (Recommend: single group.)
3. **CTRL+K scope**: nav + quick actions only (static index), or also search live identities/clients
   via the admin API? (Recommend: static nav + actions to match daybook; add live search later.)
4. **Progress wiring**: service-level `withProgress` wrapper (recommended) vs. global HTTP interceptor.
