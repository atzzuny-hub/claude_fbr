/**
 * WMS(WMS LINK) Java API 엔드포인트 — 확정분만(사용자 제공 2026-08-05).
 * WMS 메뉴 자체(연동 등록·관리)의 엔드포인트는 미확정 — 확정 전에는 여기에 추가하지 않는다.
 */
export const WMS_API = {
  /** GET 전체 WMS LINK 맵 — Req 파라미터 없음, Res: { name, idx }[] (실서버 프로브 확인).
   * 목록 화면의 WMS LINK 필터 옵션 출처. */
  linkMap: "/wmslkmap",
} as const;
