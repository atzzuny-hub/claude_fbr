/**
 * 입고(입고현황) Java API 엔드포인트 — 사용자 확정(2026-08).
 * 메서드: 목록은 GET(사용자 확정), 나머지도 조회성이라 GET 전제 — Swagger 재확인 시 갱신.
 */
export const INBOUND_API = {
  /** GET 입고 목록 조회 — Req: wmsLinkId · startDt/endDt · searchDt · status · search · 페이지 */
  list: "/dtin",
  /** GET 전체 건수 — 목록과 동일 필터에 페이지 파라미터만 없음(페이지네이션 total용) */
  count: "/dtin/cnt",
  /** GET 검색결과 전체 엑셀 다운로드(서버 생성 파일) — Phase 1은 클라이언트 CSV 생성으로 대응 중 */
  download: "/dtin/dn",
  /** GET 행 단위 상세 엑셀 다운로드 — idx는 응답의 행 고유 번호(idx) */
  downloadRow: (idx: number) => `/dtin/dn/${idx}`,
} as const;
