import type { PaginatedResponse } from '@surrogate-os/shared';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

export function parsePagination(query: {
  page?: number;
  pageSize?: number;
}): PaginationParams {
  const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
  const pageSize = Math.min(
    Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * pageSize;

  return { skip, take: pageSize, page, pageSize };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
