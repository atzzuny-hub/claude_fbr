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

/*
 * ── epoch 밀리초(UTC) 표기 ────────────────────────────────────────
 * 도메인 모델의 날짜는 UTC(+00:00) epoch 밀리초다(실서버 와이어는 초 — lib/data가
 * ms로 정규화해서 넘어온다). UTC 그대로 잘라 표기하므로 서버·브라우저 어디서 렌더해도
 * 같은 결과다(하이드레이션 안전).
 * 표시 시간대 정책(현지 창고/KST 변환 여부)은 TBD — 정책이 정해지면 이 함수들만 바꾼다.
 */

/** epoch ms → "2026-06-13" */
export function formatEpochDate(ms: number | null | undefined, fallback = "-"): string {
  if (ms == null) return fallback;
  return new Date(ms).toISOString().slice(0, 10);
}

/** epoch ms → "14:20" */
export function formatEpochTime(ms: number | null | undefined): string {
  if (ms == null) return "";
  return new Date(ms).toISOString().slice(11, 16);
}

/** epoch ms → "2026-06-13 14:20" */
export function formatEpochDateTime(ms: number | null | undefined, fallback = "-"): string {
  if (ms == null) return fallback;
  return `${formatEpochDate(ms)} ${formatEpochTime(ms)}`;
}

/**
 * 검색 패널의 날짜("YYYY-MM-DD")/날짜시간("YYYY-MM-DDTHH:mm[:ss]") 문자열 → epoch 초(10자리, UTC).
 * 날짜만 오면(길이 10) 시작 00:00:00 · 종료 23:59:59로 확장한다(검색 패널은 날짜만 받는다 —
 * 사용자 확정. 종료 경계 :59초는 레거시 요청 캡처와 동일 — 23:59:00이면 마지막 59초 행이 빠진다).
 * Req(/dtin)의 startDt/endDt가 이 값을 그대로 쓴다(프런트 파라미터 = Req 통일, 2026-08-05).
 * Date.UTC로 직접 조립하는 이유: new Date(문자열)은 실행 환경 TZ에 좌우될 수 있는데
 * 이 시스템의 날짜 축은 UTC+0 하나다 — UTC로 고정한다.
 */
export function toEpochSeconds(dateBound: string, endOfDay: boolean): number {
  const normalized =
    dateBound.length === 10 ? `${dateBound}T${endOfDay ? "23:59:59" : "00:00:00"}` : dateBound.slice(0, 19);
  const [datePart, timePart] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = (timePart ?? "00:00:00").split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute, second || 0) / 1000);
}

/**
 * 최근 N일 기간("YYYY-MM-DD" 쌍, UTC 기준) — 시작일 = 오늘-N일, 종료일 = 오늘.
 * 목록 화면의 기본 기간(입고: 최근 1주 — 사용자 확정 2026-08-05)을 만들 때 쓴다:
 * 서버(page.tsx 첫 진입)와 브라우저(SearchPanel 초기화 버튼)가 같은 함수를 써서 같은 값을
 * 얻는다. UTC인 이유: 이 시스템의 날짜 축은 UTC+0 하나다(응답 epoch 표시·Req epoch 변환
 * 전부) — "오늘"만 로컬(KST 등)로 계산하면 새벽 시간대에 하루 어긋난다.
 */
export function recentPeriodUtc(days: number): { from: string; to: string } {
  const now = Date.now();
  return {
    from: new Date(now - days * 86_400_000).toISOString().slice(0, 10),
    to: new Date(now).toISOString().slice(0, 10),
  };
}
