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

export type SortOrder = "asc" | "desc";

/**
 * 목록 정렬 — sort(컬럼 키)에 대응하는 값을 getValue로 뽑아 비교한다.
 * - sort가 없으면 원본 순서 그대로 반환한다.
 * - 빈 값(null/undefined/"")은 방향과 무관하게 항상 뒤로 보낸다(미도착 날짜 등이 위로 몰리지 않게).
 * - 문자열은 localeCompare("ko")로 한글/영문 정렬을 자연스럽게, 그 외는 대소 비교.
 * - 동률은 원래 순서를 유지하는 안정 정렬(인덱스 tie-break). 원본 배열은 건드리지 않는다.
 */
export function sortItems<T>(
  items: T[],
  sort: string | undefined,
  order: SortOrder | undefined,
  getValue: (row: T, key: string) => string | number | null | undefined,
): T[] {
  if (!sort) return items;
  const dir = order === "desc" ? -1 : 1;
  const isEmpty = (v: string | number | null | undefined) => v === null || v === undefined || v === "";
  return items
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = getValue(a.row, sort);
      const bv = getValue(b.row, sort);
      if (isEmpty(av) && isEmpty(bv)) return a.index - b.index;
      if (isEmpty(av)) return 1; // 빈 값은 방향과 무관하게 뒤로
      if (isEmpty(bv)) return -1;
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv, "ko");
      } else {
        cmp = av < bv ? -1 : av > bv ? 1 : 0;
      }
      return cmp !== 0 ? cmp * dir : a.index - b.index;
    })
    .map((entry) => entry.row);
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
