/**
 * URL searchParams 조립용 순수 유틸 — SearchPanel/DataTable 페이지네이션이 공유한다.
 * lib/data가 아닌 순수 UI 헬퍼이므로 Phase 2에서도 그대로 재사용 가능하다.
 */

export type QueryValue = string | number | undefined | null;

/** undefined/null/빈 문자열 키는 제외하고 querystring을 만든다 (전체/미지정 필터는 파라미터 생략). */
export function buildQueryString(params: Record<string, QueryValue>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, String(value));
  }
  return usp.toString();
}

/**
 * 기존 URLSearchParams(현재 필터)를 유지한 채 일부 키만 갱신한 querystring을 만든다.
 * DataTable의 page/pageSize 변경처럼 "다른 필터는 그대로 두고 이 값만 바꾼다"에 사용.
 */
export function mergeSearchParams(
  current: URLSearchParams,
  updates: Record<string, QueryValue>,
): string {
  const merged = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === "") {
      merged.delete(key);
    } else {
      merged.set(key, String(value));
    }
  }
  return merged.toString();
}

/**
 * Next.js page의 `searchParams` prop(Record<string, string | string[] | undefined>)을
 * 단일 문자열 Record로 정규화한다(배열 값은 첫 값만 사용). 서버 컴포넌트 페이지에서
 * 도메인 SearchParams 타입으로 옮기기 전 1차 가공 단계로 사용한다.
 */
export function flattenSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    const resolved = Array.isArray(value) ? value[0] : value;
    if (resolved !== undefined) flat[key] = resolved;
  }
  return flat;
}
