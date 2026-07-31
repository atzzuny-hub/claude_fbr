import type { Paginated } from "@/types";

/**
 * lib/data 공통 유틸 — 검색/페이지네이션/지연 시뮬레이션.
 * Phase 2에서 BFF로 교체되어도 이 파일의 로직(순수 함수)은 그대로 재사용 가능하다.
 */

export const DEFAULT_MOCK_DELAY_MS = 300;

// 로딩 상태 확인용 지연 시뮬레이션 (200~400ms 권장 범위 내 고정값)
export function delay(ms: number = DEFAULT_MOCK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function paginate<T>(items: T[], page?: number, pageSize?: number): Paginated<T> {
  const safePage = page && page > 0 ? Math.floor(page) : 1;
  const safePageSize = pageSize && pageSize > 0 ? Math.floor(pageSize) : 20;
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  };
}

// dateValue는 ISO 날짜 또는 날짜시간 문자열 — 앞 10자(YYYY-MM-DD)만 비교한다.
// 기간 필터(dateFrom/dateTo)가 아예 없으면 항상 통과, 필터가 있는데 값이 없으면 제외한다.
export function withinDateRange(
  dateValue: string | null | undefined,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!dateValue) return false;
  const value = dateValue.slice(0, 10);
  if (dateFrom && value < dateFrom) return false;
  if (dateTo && value > dateTo) return false;
  return true;
}

export function matchesKeyword(
  keyword: string | undefined,
  ...fields: (string | null | undefined)[]
): boolean {
  const normalized = keyword?.trim().toLowerCase();
  if (!normalized) return true;
  return fields.some((field) => !!field && field.toLowerCase().includes(normalized));
}
