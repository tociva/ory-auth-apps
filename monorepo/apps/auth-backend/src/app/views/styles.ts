/**
 * Self-contained CSS for the server-rendered auth pages, inlined into every
 * page's <head>. Ported from the old Angular app's styles.css, with the
 * `--tng-*` (TailNG) theme fallbacks resolved to plain values since there's no
 * component library here anymore.
 */
export const STYLES = /* css */ `
:root { --brand: #367588; --brand-hover: #2c606f; }

*, *::before, *::after { box-sizing: border-box; }

html, body {
  height: 100%;
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  color: #1f2937;
  background: #eef4fb;
}

.page-center {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.card {
  width: 100%;
  max-width: 24rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 1.75rem;
}
.card-error { max-width: 32rem; }

.card-header { text-align: center; margin-bottom: 1.25rem; }
.brand-name { font-size: 1.5rem; font-weight: 700; color: var(--brand); margin: 0; }
.brand-tagline { font-size: 0.875rem; color: #6b7280; margin: 0.25rem 0 0; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  border: 2px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  line-height: 1.4;
}
.btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.btn-sm { width: auto; padding: 0.375rem 0.875rem; font-size: 0.8125rem; }

.btn-primary { background: var(--brand); color: #fff; border-color: var(--brand); }
.btn-primary:hover { background: var(--brand-hover); border-color: var(--brand-hover); }

.btn-outline { background: #fff; color: var(--brand); border-color: var(--brand); }
.btn-outline:hover { background: var(--brand); color: #fff; }
.btn-outline:hover .google-icon path { fill: #fff; }

.btn-google { font-weight: 600; }
.google-icon { width: 18px; height: 18px; }

.alert { padding: 0.875rem 1rem; border-radius: 0.625rem; border: 1px solid; font-size: 0.875rem; margin-bottom: 1rem; }
.alert-error { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
.alert-warning { background: #fffbeb; border-color: #fde68a; color: #92400e; }

.link { color: var(--brand); text-decoration: underline; background: none; border: none; cursor: pointer; font: inherit; padding: 0; }
.link:hover { opacity: 0.75; }

.terms-text { font-size: 0.75rem; color: #6b7280; text-align: center; margin: 1.25rem 0 0; }

.error-title { font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem; }
.hint-title { display: block; margin-bottom: 0.25rem; }
.hint-body { margin: 0; }
.details-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.details-label { font-size: 0.8125rem; font-weight: 600; color: #374151; }
.error-pre {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.875rem;
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.card-footer { margin-top: 1.25rem; text-align: center; }
`;
