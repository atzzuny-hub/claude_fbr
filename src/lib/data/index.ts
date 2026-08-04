// 데이터 접근 함수 배럴 — 화면/컴포넌트는 이 배럴(@/lib/data)을 통해서만 데이터를 가져온다.
// Phase 1: 아래 각 파일 내부가 lib/mock의 목데이터를 반환한다.
// Phase 2: 각 파일 내부만 BFF(Route Handler) 호출로 교체한다(이 배럴의 시그니처는 유지).

export * from "./session";
export * from "./auth";
export * from "./wms-links";
export * from "./clients";
export * from "./skus";
export * from "./inbounds";
export * from "./outbounds";
export * from "./returns";
export * from "./inventory";
export * from "./wms-requests";
export * from "./users";
export * from "./vendors";
