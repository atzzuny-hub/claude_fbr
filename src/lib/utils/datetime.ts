/**
 * ISO 날짜시간 문자열의 표시 포맷 — 문자열을 그대로 잘라 쓰고 Date로 파싱하지 않는다.
 *
 * Date로 파싱해 toLocaleString을 쓰지 않는 이유: 목록은 Server Component에서 렌더되므로
 * 브라우저 시간대로 변환하면 서버와 클라이언트의 결과가 달라져 하이드레이션이 어긋난다.
 * 값은 이미 "표시할 기준 시각"(현지 창고 시간)으로 내려온다는 전제로 다룬다 —
 * 실제 API가 어떤 시간대·표기로 주는지는 Swagger 확인 후 확정한다(CLAUDE.md TBD).
 */

/** "2026-06-13T14:20:00Z" → "2026-06-13" */
export function formatDate(value: string | null | undefined, fallback = "-"): string {
  if (!value) return fallback;
  return value.slice(0, 10);
}

/** "2026-06-13T14:20:00Z" → "14:20" (시간 정보가 없으면 빈 문자열) */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(11, 16);
}

/** "2026-06-13T14:20:00Z" → "2026-06-13 14:20" (날짜만 있으면 날짜만) */
export function formatDateTime(value: string | null | undefined, fallback = "-"): string {
  if (!value) return fallback;
  const time = formatTime(value);
  return time ? `${formatDate(value)} ${time}` : formatDate(value);
}

/**
 * Date → <input type="date"> 값("YYYY-MM-DD", 로컬 시간대 기준).
 * toISOString()은 UTC로 변환하므로 자정 전후나 해외 시간대에서 날짜가 하루 밀린다 —
 * 로컬 연/월/일을 직접 조립한다. (브라우저에서 "오늘" 같은 상대 날짜를 만들 때 사용)
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
