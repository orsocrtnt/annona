import type { DeliveryCategory, OrderStatus } from "@prisma/client";

export const ORDER_HISTORY_DEFAULT_PAGE_SIZE = 50;
export const ORDER_HISTORY_PAGE_SIZES = [25, 50, 100] as const;
export const ORDER_EXPORT_CHUNK_SIZE = 500;

export interface OrderHistoryQuery {
  page: number;
  pageSize: (typeof ORDER_HISTORY_PAGE_SIZES)[number];
  search?: string;
  status?: OrderStatus;
  category?: DeliveryCategory;
  from?: string;
  to?: string;
  history?: boolean;
}

export interface OrderHistoryPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export function orderHistorySearchParams(
  query: Partial<OrderHistoryQuery>,
  options?: { includePage?: boolean }
) {
  const params = new URLSearchParams();
  if (options?.includePage !== false && query.page && query.page > 1) {
    params.set("page", String(query.page));
  }
  if (query.pageSize && query.pageSize !== ORDER_HISTORY_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.history != null) params.set("history", String(query.history));
  return params;
}
