/**
 * 목데이터 생성 보조 유틸 — lib/mock 내부 전용.
 * 런타임 랜덤(faker, Math.random, Date.now 등) 금지 — 인덱스 기반 순환/산술만 사용해
 * 매 실행 동일한 결과를 보장한다.
 */

// 최근 6주(2026-06-19 ~ 2026-07-31, 기준일 2026-07-31) 분포용 날짜 풀.
// 도메인마다 시작 인덱스를 다르게 주면 서로 다른 패턴으로 순환한다.
export const RECENT_DATES: readonly string[] = [
  "2026-06-19",
  "2026-06-22",
  "2026-06-24",
  "2026-06-26",
  "2026-06-29",
  "2026-07-01",
  "2026-07-03",
  "2026-07-06",
  "2026-07-08",
  "2026-07-10",
  "2026-07-13",
  "2026-07-15",
  "2026-07-17",
  "2026-07-20",
  "2026-07-22",
  "2026-07-24",
  "2026-07-27",
  "2026-07-29",
  "2026-07-30",
  "2026-07-31",
];

export function pickDate(index: number, offset = 0): string {
  const list = RECENT_DATES;
  return list[(index + offset) % list.length];
}

export function toDatetime(date: string, time = "09:00:00"): string {
  return `${date}T${time}Z`;
}

export function pad(num: number, width: number): string {
  return String(num).padStart(width, "0");
}

export function compactDate(date: string): string {
  return date.replaceAll("-", "");
}
