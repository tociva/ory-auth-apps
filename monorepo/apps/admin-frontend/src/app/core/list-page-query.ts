import type { ParamMap, Params } from "@angular/router";

export const LIST_PAGE_DEFAULT_PAGE_SIZE = 25;
export const LIST_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export interface ListPageQuery {
  q: string;
  status: string;
  /** 1-based page number for the URL. */
  page: number;
  pageSize: number;
}

export function parseListPageQuery(
  params: ParamMap,
  options?: {
    defaultPageSize?: number;
    pageSizeOptions?: readonly number[];
  },
): ListPageQuery {
  const defaultPageSize = options?.defaultPageSize ?? LIST_PAGE_DEFAULT_PAGE_SIZE;
  const pageSizeOptions = options?.pageSizeOptions ?? LIST_PAGE_SIZE_OPTIONS;

  const q = (params.get("q") ?? "").trim();
  const status = (params.get("status") ?? "").trim();

  const pageRaw = Number(params.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(params.get("pageSize") ?? String(defaultPageSize));
  const pageSize = (pageSizeOptions as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : defaultPageSize;

  return { q, status, page, pageSize };
}

/** Build query params for navigation; omits empty filters and default pagination. */
export function toListPageQueryParams(
  query: Partial<ListPageQuery>,
  options?: {
    defaultPageSize?: number;
    includeStatus?: boolean;
  },
): Params {
  const defaultPageSize = options?.defaultPageSize ?? LIST_PAGE_DEFAULT_PAGE_SIZE;
  const includeStatus = options?.includeStatus ?? true;
  const params: Params = {};

  const q = query.q?.trim() ?? "";
  params["q"] = q || null;

  if (includeStatus) {
    const status = query.status?.trim() ?? "";
    params["status"] = status || null;
  }

  const page = query.page ?? 1;
  params["page"] = page > 1 ? String(page) : null;

  const pageSize = query.pageSize ?? defaultPageSize;
  params["pageSize"] = pageSize !== defaultPageSize ? String(pageSize) : null;

  return params;
}

export function clampListPage(page: number, totalItems: number, pageSize: number): number {
  const safeSize = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(totalItems / safeSize) || 1);
  return Math.min(Math.max(1, page), pageCount);
}

export function paginateItems<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safeSize;
  return items.slice(start, start + safeSize);
}

export function matchesListSearch(haystack: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}
