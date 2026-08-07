import { z } from "zod";

/**
 * 상태 코드값(영문 union) / 라벨(한국어 표시명) 분리 — 단일 출처.
 * 라벨은 CLAUDE.md·PRD의 확정 명칭을 한 글자도 바꾸지 않는다.
 *
 * ⚠️ 확인 필요(설계 시 판단): PRD 데이터 모델 표는 Outbound.status(출고상태),
 * Return.status(반품상태), WmsLink.sync_status(연동 상태)를 값 없이 "enum"으로만
 * 표기했다(Inbound·NEW 요청과 달리 CLAUDE.md의 "확정 명칭" 목록에도 없음).
 * 아래 OUTBOUND_STATUS/RETURN_STATUS/WMS_LINK_SYNC_STATUS는 현행 물류 흐름을
 * 참고해 같은 코드값/라벨 분리 패턴으로 새로 설계한 값이며, 확정 명칭이 아니므로
 * 현행 화면 확인 후 조정이 필요할 수 있다.
 */

// ── 입고상태 (Swagger 확정) ───────────────────────────────────────
// 코드값은 입고 목록 API 응답의 status 그대로 — PLAN | STANDBY | WORK | COMPLETED | CANCELED |
// UNKNOW (UNKNOW는 API 표기 그대로이며 오타가 아니다). 표시명은 CLAUDE.md 확정 명칭
// (예정 → 대기 → 작업중 → 입고, 취소 — WORK=작업중은 사용자 확정 2026-08-05: 문서상
// 없는 값으로 알려졌으나 실데이터에 실재해 정식 편입).
// 순차 진행: 예정 → 대기 → 작업중 → 입고. 취소(CANCELED)는 파이프라인 밖의 종료 상태 —
// 목록 배지는 붉은 톤, 스테퍼는 진행 단계 대신 붉은 X 단일 노드로 표시한다.
// UNKNOW: WMS 원본 코드(statusOriginalCode)를 표준 상태로 매핑하지 못한 응답 전용 값.
export const INBOUND_STATUS = ["PLAN", "STANDBY", "WORK", "COMPLETED", "CANCELED", "UNKNOW"] as const;
export type InboundStatus = (typeof INBOUND_STATUS)[number];
export const inboundStatusSchema = z.enum(INBOUND_STATUS);
export const INBOUND_STATUS_LABEL: Record<InboundStatus, string> = {
  PLAN: "예정",
  STANDBY: "대기",
  WORK: "작업중",
  COMPLETED: "입고",
  CANCELED: "취소",
  UNKNOW: "알 수 없음",
};
// 검색 필터로 보낼 수 있는 상태(목록 Req의 status enum과 1:1) — UNKNOW는 응답 전용이라 제외.
export const INBOUND_STATUS_FILTER = ["PLAN", "STANDBY", "WORK", "COMPLETED", "CANCELED"] as const satisfies readonly InboundStatus[];
export const inboundStatusFilterSchema = z.enum(INBOUND_STATUS_FILTER);
// 순차 진행 파이프라인(스테퍼 단계용) — 취소는 파이프라인 밖의 종료 상태라 제외한다.
// 스테퍼는 이 배열로 단계를 그리고, 취소 행은 StatusStepper의 terminal 노드로 따로 표시한다.
// WORK(작업중)의 위치는 물류 흐름상 대기와 입고 사이로 배치(원본 코드: STANDBY=1 · WORK=20 ·
// COMPLETED=3/50이라 코드 순서로는 판별 불가 — 흐름이 다르면 이 배열만 조정).
export const INBOUND_STATUS_FLOW = ["PLAN", "STANDBY", "WORK", "COMPLETED"] as const satisfies readonly InboundStatus[];


// ── 출고상태 (코드값 Swagger 확정 · 표시명은 설계값) ──────────────
// 코드값은 출고 목록 API(GET /dtob) 응답의 status 그대로(로컬 Swagger 확인 2026-08-06) —
// PEND | PICK | PACK | COMPLETED | CANCELED | HOLDED | RETURNED | P_RETURNED | UNKNOW.
// HOLDED(보류)는 Swagger Res enum엔 없고 Req 예시에만 있던 값 — 사용자 확정(2026-08-07)으로
// 정식 편입(입고 WORK 전례). 배열 내 위치는 Req 예시 순서(… CANCELED | HOLDED) 계승 — 설계
// 배치라 흐름이 다르면 위치만 조정한다(정렬 인덱스·필터 옵션 순서에만 영향).
// ⚠️ 한국어 표시명은 설계값(확인 필요) — CLAUDE.md 확정 명칭 목록에 출고 라벨이 없다.
//   현행 화면 확인 후 라벨만 조정한다(코드값은 응답 확정이라 불변). CANCELED=취소(공통 종료
//   상태, 사용자 확정)·UNKNOW=알 수 없음(원본 코드 매핑 실패, 입고와 동일 관례)만 확정 계승.
export const OUTBOUND_STATUS = ["PEND", "PICK", "PACK", "COMPLETED", "CANCELED", "HOLDED", "RETURNED", "P_RETURNED", "UNKNOW"] as const;
export type OutboundStatus = (typeof OUTBOUND_STATUS)[number];
export const outboundStatusSchema = z.enum(OUTBOUND_STATUS);
export const OUTBOUND_STATUS_LABEL: Record<OutboundStatus, string> = {
  PEND: "접수", // 설계값 — 주문 접수 후 출고 작업 전(pending)
  PICK: "피킹", // 설계값
  PACK: "패킹", // 설계값
  COMPLETED: "출고", // 설계값 — 입고의 COMPLETED="입고"와 같은 명명 패턴
  CANCELED: "취소", // 확정(입고·출고·반품 공통 종료 상태)
  HOLDED: "보류", // 설계값 — Req 예시에만 있던 값의 정식 편입(사용자 확정 2026-08-07)
  RETURNED: "반품", // 설계값
  P_RETURNED: "부분반품", // 설계값 — P_ = partial 추정
  UNKNOW: "알 수 없음", // 입고와 동일 관례(응답 전용)
};
// 검색 필터(UNKNOW 제외 — 응답 전용) — HOLDED는 Req 예시 출신이라 필터에도 포함(사용자 확정
// 2026-08-07). 잔여 불일치(백엔드 확인): RETURNED/P_RETURNED가 Req 예시엔 없다 — Res enum
// 기반으로 계속 포함해 두고 필터로 실제 검색되는지는 실연동 시 검증한다.
// ※ Req의 status는 입고와 달리 **배열**(다중 선택)이다.
export const OUTBOUND_STATUS_FILTER = ["PEND", "PICK", "PACK", "COMPLETED", "CANCELED", "HOLDED", "RETURNED", "P_RETURNED"] as const satisfies readonly OutboundStatus[];
export const outboundStatusFilterSchema = z.enum(OUTBOUND_STATUS_FILTER);
// 순차 진행 파이프라인(스테퍼용, 잠정 설계) — 접수 → 피킹 → 패킹 → 출고.
// CANCELED는 파이프라인 밖 종료 상태(공통 확정 — 붉은 X 단일 노드), HOLDED는 순차 진행이
// 멈춘 보류 상태라 파이프라인에서 제외, RETURNED/P_RETURNED는 출고 이후의 반품 계열이라
// 제외(비파이프라인 상태의 스테퍼 표현 방식은 화면 조립 시 결정).
export const OUTBOUND_STATUS_FLOW = ["PEND", "PICK", "PACK", "COMPLETED"] as const satisfies readonly OutboundStatus[];

// ── 배송상태 (출고 전용 · 코드값 Swagger 확정 · 표시명은 설계값) ──
// 출고 응답의 delivery 필드(nullable — 배송 단계 전이면 값 없음). 코드값은 Res 예시 그대로 —
// DELIVERING | DELIVERED | COMPLETED | RETURNED | UNKNOW.
// ⚠️ 표시명 설계값 — 특히 DELIVERED(배송완료)와 COMPLETED(완료)의 의미 차이 미확인
//   (COMPLETED = 구매확정 추정). 현행 화면 확인 후 조정.
export const OUTBOUND_DELIVERY = ["DELIVERING", "DELIVERED", "COMPLETED", "RETURNED", "UNKNOW"] as const;
export type OutboundDelivery = (typeof OUTBOUND_DELIVERY)[number];
export const outboundDeliverySchema = z.enum(OUTBOUND_DELIVERY);
export const OUTBOUND_DELIVERY_LABEL: Record<OutboundDelivery, string> = {
  DELIVERING: "배송중", // 설계값
  DELIVERED: "배송완료", // 설계값
  COMPLETED: "완료", // 설계값 — DELIVERED와의 차이 확인 필요
  RETURNED: "반품", // 설계값
  UNKNOW: "알 수 없음", // 입고와 동일 관례(응답 전용)
};
// 검색 필터 후보(잠정) — Req의 delivery 예시는 "DELIVERING | DELIVERED | CANCELED"로
// Res enum과 어긋난다(CANCELED는 Res delivery에 없음). status와 같은 이유로 Res 기반
// (UNKNOW 제외)으로 두고 CANCELED는 넣지 않는다. Req의 delivery도 배열(다중 선택).
export const OUTBOUND_DELIVERY_FILTER = ["DELIVERING", "DELIVERED", "COMPLETED", "RETURNED"] as const satisfies readonly OutboundDelivery[];
export const outboundDeliveryFilterSchema = z.enum(OUTBOUND_DELIVERY_FILTER);

// ── 반품상태 (설계값 — 확인 필요) ─────────────────────────────────
export const RETURN_STATUS = ["REQUESTED", "INSPECTING", "COMPLETED"] as const;
export type ReturnStatus = (typeof RETURN_STATUS)[number];
export const returnStatusSchema = z.enum(RETURN_STATUS);
export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: "접수",
  INSPECTING: "검수중",
  COMPLETED: "완료",
};

// ── WMS 연동 상태 (설계값 — 확인 필요) ────────────────────────────
export const WMS_LINK_SYNC_STATUS = ["CONNECTED", "PENDING", "DISCONNECTED"] as const;
export type WmsLinkSyncStatus = (typeof WMS_LINK_SYNC_STATUS)[number];
export const wmsLinkSyncStatusSchema = z.enum(WMS_LINK_SYNC_STATUS);
export const WMS_LINK_SYNC_STATUS_LABEL: Record<WmsLinkSyncStatus, string> = {
  CONNECTED: "연동",
  PENDING: "연동대기",
  DISCONNECTED: "연동해제",
};

// ── 클라이언트 상태 (PRD 확정: 활성/비활성) ───────────────────────
export const CLIENT_STATUS = ["ACTIVE", "INACTIVE"] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];
export const clientStatusSchema = z.enum(CLIENT_STATUS);
export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
};

// ── 사용자 상태 (사용자 페이지 "비활성화" 기능 대응) ──────────────
export const USER_STATUS = ["ACTIVE", "INACTIVE"] as const;
export type UserStatus = (typeof USER_STATUS)[number];
export const userStatusSchema = z.enum(USER_STATUS);
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "활성",
  INACTIVE: "비활성",
};

// ── 사용자 역할 ───────────────────────────────────────────────────
export const USER_ROLE = ["OPERATOR", "CLIENT"] as const;
export type UserRole = (typeof USER_ROLE)[number];
export const userRoleSchema = z.enum(USER_ROLE);
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  OPERATOR: "운영자",
  CLIENT: "클라이언트",
};

// ── NEW 요청 상태 (확정) ──────────────────────────────────────────
export const WMS_REQUEST_STATUS = ["SUBMITTED", "PENDING_WMS", "REGISTERED"] as const;
export type WmsRequestStatus = (typeof WMS_REQUEST_STATUS)[number];
export const wmsRequestStatusSchema = z.enum(WMS_REQUEST_STATUS);
export const WMS_REQUEST_STATUS_LABEL: Record<WmsRequestStatus, string> = {
  SUBMITTED: "제출됨",
  PENDING_WMS: "WMS 등록 대기",
  REGISTERED: "등록 완료",
};

// ── NEW 요청 유형 (확장 가능) ─────────────────────────────────────
export const WMS_REQUEST_TYPE = [
  "PRODUCT_REGISTRATION",
  "GIFT_REGISTRATION",
  "LABEL_CREATION",
] as const;
export type WmsRequestType = (typeof WMS_REQUEST_TYPE)[number];
export const wmsRequestTypeSchema = z.enum(WMS_REQUEST_TYPE);
export const WMS_REQUEST_TYPE_LABEL: Record<WmsRequestType, string> = {
  PRODUCT_REGISTRATION: "상품등록",
  GIFT_REGISTRATION: "사은품 등록",
  LABEL_CREATION: "라벨 생성",
};
