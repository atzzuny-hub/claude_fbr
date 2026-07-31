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

// ── 입고상태 (확정) ───────────────────────────────────────────────
export const INBOUND_STATUS = ["SCHEDULED", "WAITING", "RECEIVED"] as const;
export type InboundStatus = (typeof INBOUND_STATUS)[number];
export const inboundStatusSchema = z.enum(INBOUND_STATUS);
export const INBOUND_STATUS_LABEL: Record<InboundStatus, string> = {
  SCHEDULED: "예정",
  WAITING: "대기",
  RECEIVED: "입고",
};

// ── 출고상태 (설계값 — 확인 필요) ─────────────────────────────────
export const OUTBOUND_STATUS = ["SCHEDULED", "PREPARING", "SHIPPED"] as const;
export type OutboundStatus = (typeof OUTBOUND_STATUS)[number];
export const outboundStatusSchema = z.enum(OUTBOUND_STATUS);
export const OUTBOUND_STATUS_LABEL: Record<OutboundStatus, string> = {
  SCHEDULED: "예정",
  PREPARING: "준비중",
  SHIPPED: "출고완료",
};

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
