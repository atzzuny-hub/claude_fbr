// Java API 엔드포인트 정의 배럴 — 도메인별 한 파일, Swagger/사용자로 확정된 것만 담는다.
// 미확정 도메인은 파일을 만들지 않는다(TBD 임의 확정 금지 — CLAUDE.md).
//
// 역할 경계:
//  - 여기는 "경로 정의"만 둔다 — fetch·인증·응답 래핑 해석 등 호출 코드는 Phase 2의
//    BFF(app/api Route Handler)가 담당하며, API_BASE_URL(서버 전용 env)과 조합해 쓴다.
//    브라우저가 이 경로를 직접 치는 일은 없다(CLAUDE.md 아키텍처 원칙 3).
//  - lib/data = 화면 ↔ 데이터 계약(Phase 1 목 → Phase 2 BFF 호출로 내부 교체),
//    lib/api  = BFF ↔ Java API 계약(경로 단일 출처).
//  - 응답 전역 래핑({ code, data, message }) 여부는 미확인 — 확정되면 공통 타입을 여기에 추가.
//
// 새 도메인 추가: outbound.ts 등 도메인 파일을 만들어 *_API 상수(경로 리터럴 + 파라미터는
// 함수)로 정의하고 아래에서 재수출한다.

export * from "./auth";
export * from "./inbound";
export * from "./wms";
