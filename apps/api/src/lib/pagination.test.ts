import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginatedResponse } from './pagination.js';

describe('parsePagination', () => {
  it('defaults to page 1 and pageSize 20', () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('respects custom page and pageSize', () => {
    const result = parsePagination({ page: 3, pageSize: 10 });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.skip).toBe(20);
    expect(result.take).toBe(10);
  });

  it('caps pageSize at 100', () => {
    const result = parsePagination({ pageSize: 500 });
    expect(result.pageSize).toBe(100);
    expect(result.take).toBe(100);
  });

  it('enforces minimum page of 1', () => {
    const result = parsePagination({ page: -5 });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('enforces minimum pageSize of 1', () => {
    const result = parsePagination({ pageSize: 0 });
    expect(result.pageSize).toBe(1);
    expect(result.take).toBe(1);
  });
});

describe('buildPaginatedResponse', () => {
  it('calculates totalPages correctly', () => {
    const result = buildPaginatedResponse(['a', 'b', 'c'], 25, 1, 10);
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.data).toEqual(['a', 'b', 'c']);
  });

  it('handles empty data', () => {
    const result = buildPaginatedResponse([], 0, 1, 20);
    expect(result.totalPages).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('handles exact page boundaries', () => {
    const result = buildPaginatedResponse(['a', 'b'], 40, 2, 20);
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(2);
  });

  it('handles total not evenly divisible by pageSize', () => {
    const result = buildPaginatedResponse(['x'], 21, 2, 10);
    expect(result.totalPages).toBe(3); // ceil(21/10)
  });

  it('handles single-item total', () => {
    const result = buildPaginatedResponse(['only'], 1, 1, 20);
    expect(result.totalPages).toBe(1);
  });
});
