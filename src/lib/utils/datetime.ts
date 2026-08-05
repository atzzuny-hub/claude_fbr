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
 * ── epoch 표시(한국시간 KST, UTC+9 고정) ──────────────────────────
 * 데이터 축은 UTC epoch(와이어 초 → 도메인 ms — lib/data·화면 공용 정규화)이고,
 * **표시만 KST(+9)로 변환**한다(사용자 확정 2026-08-05 — 레거시 어드민 표시와 동일:
 * 예) 접수번호 20260804-10의 reqDt UTC 02:22 → 화면 11:22).
 * 브라우저 로컬 시간대(new Date().toLocaleString 등)가 아니라 +9 "고정" 오프셋인 이유:
 * 목록은 서버(SSR)와 브라우저 양쪽에서 렌더되므로 실행 환경 시간대에 따르면 하이드레이션이
 * 어긋난다 — 어디서 렌더해도 같은 결과여야 한다. 표시 시간대 정책이 바뀌면(현지 창고 시간 등)
 * 이 상수·함수들만 바꾼다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** epoch ms(UTC) → KST 시각의 ISO 문자열 — 슬라이스해서 표기용으로만 쓴다 */
function toKstIso(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString();
}

/** epoch ms → "2026-06-13" (KST) */
export function formatEpochDate(ms: number | null | undefined, fallback = "-"): string {
  if (ms == null) return fallback;
  return toKstIso(ms).slice(0, 10);
}

/** epoch ms → "14:20" (KST) */
export function formatEpochTime(ms: number | null | undefined): string {
  if (ms == null) return "";
  return toKstIso(ms).slice(11, 16);
}

/** epoch ms → "2026-06-13 14:20" (KST) */
export function formatEpochDateTime(ms: number | null | undefined, fallback = "-"): string {
  if (ms == null) return fallback;
  return `${formatEpochDate(ms)} ${formatEpochTime(ms)}`;
}

/**
 * 검색 패널의 날짜("YYYY-MM-DD")/날짜시간("YYYY-MM-DDTHH:mm[:ss]") 문자열 → epoch 초(10자리, UTC).
 * 날짜만 오면(길이 10) 시작 00:00:00 · 종료 23:59:59로 확장한다(검색 패널은 날짜만 받는다 —
 * 사용자 확정. 종료 경계 :59초는 레거시 요청 캡처와 동일 — 23:59:00이면 마지막 59초 행이 빠진다).
 * Req(/dtin)의 startDt/endDt가 이 값을 그대로 쓴다(프런트 파라미터 = Req 통일, 2026-08-05).
 * 경계는 **UTC 자정 기준**이다(표시는 KST지만 경계는 UTC — 비대칭이 맞다): 레거시 캡처의
 * startDt=1785196800이 정확히 UTC 2026-07-28 00:00:00 — 레거시도 표시는 KST, 경계는
 * UTC 자정으로 보낸다(new Date("YYYY-MM-DD")가 UTC 자정으로 파싱되는 관례의 계승).
 * Java 비교 축도 이 값 기준이므로 레거시와 같은 검색 결과를 얻으려면 같은 경계를 보내야 한다.
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
 * 최근 N일 기간("YYYY-MM-DD" 쌍, **KST 달력 기준**) — 시작일 = 오늘-N일, 종료일 = 오늘.
 * 목록 화면의 기본 기간(입고: 최근 1주 — 사용자 확정 2026-08-05)을 만들 때 쓴다:
 * 서버(page.tsx 첫 진입)와 브라우저(SearchPanel 초기화 버튼)가 같은 함수를 써서 같은 값을
 * 얻는다(+9 고정 오프셋이라 실행 환경 무관). "오늘"이 KST인 이유: 표시가 KST라(위 참조)
 * 사용자가 보는 날짜와 기본 기간의 종료일이 같아야 한다 — UTC로 계산하면 KST 새벽(00~09시)에
 * 종료일이 "어제"로 보인다. 날짜 문자열 → 기간 경계 epoch 변환은 toEpochSeconds(UTC 자정,
 * 레거시 동일)가 담당한다.
 */
export function recentPeriodKst(days: number): { from: string; to: string } {
  const nowKst = Date.now() + KST_OFFSET_MS;
  return {
    from: new Date(nowKst - days * 86_400_000).toISOString().slice(0, 10),
    to: new Date(nowKst).toISOString().slice(0, 10),
  };
}
