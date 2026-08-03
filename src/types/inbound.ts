import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";
import { inboundStatusFilterSchema, inboundStatusSchema } from "./status";

/**
 * Inbound (입고) — 입고 목록 API 응답 스키마 그대로(Swagger 확정, 필드명 변경 금지).
 * 날짜류는 전부 UTC(+00:00) epoch 밀리초(integer) — 표시할 때는 lib/utils/datetime의
 * formatEpoch* 계열을 쓴다(문자열 파싱 금지).
 *
 * 응답에 클라이언트 ID가 없다(clntName뿐) — CLIENT 데이터 격리는 서버(API/BFF)가 세션으로
 * 스코핑하는 전제다. Phase 1 목데이터 스코핑은 lib/data/inbounds.ts가 이름으로 잇는다.
 *
 * ※ Swagger 대비 우리 쪽에서 느슨하게 둔 부분(연동 시 확인):
 *  - sipDt/etaDt/arvDt: 명세에 nullable 표기가 없지만, 미도래 단계(예: 예정 상태의 창고
 *    도착일)는 값이 있을 수 없으므로 nullable로 모델링했다 — 실제 응답이 0/누락/값 중
 *    무엇을 주는지 확인 필요.
 */

/** 제품 목록(SKU LIST) 한 줄 — 행 확장 상세의 상품 표와 1:1 */
export const inboundSkuSchema = z.object({
  sku: z.string(), // 제품 sku
  productName: z.string(), // 제품 이름
  expQty: z.number().int().nonnegative(), // 접수 수량
  qty: z.number().int().nonnegative(), // 접수 수량 중 사용 가능 수량
  excQty: z.number().int().nonnegative(), // 접수 수량 중 오류 수량
  unit: z.string(), // 수량 단위 (예: Pcs)
});
export type InboundSku = z.infer<typeof inboundSkuSchema>;

export const inboundSchema = z.object({
  idx: z.number().int(), // IDX — 행 고유 번호(int64)
  wmsId: z.number().int(), // WMS ID
  wmsLinkId: z.number().int(), // WMS LINK ID
  wmsLinkName: z.string(), // WMS LINK Name (예: ETON 01)
  statusOriginalCode: z.string().nullable(), // 입고상태 원본 코드(WMS 원문)
  status: inboundStatusSchema, // 입고상태 (PLAN | STANDBY | COMPLETED | CANCELED | UNKNOW)
  ganNo: z.string().nullable(), // 접수번호 (마켓주문번호)
  clntName: z.string().nullable(), // 클라이언트 이름
  cntyCd: countrySchema, // 국가코드
  reqDt: z.number().int(), // 접수일 (UTC epoch ms)
  sipDt: z.number().int().nullable(), // 배송일 (UTC epoch ms)
  etaDt: z.number().int().nullable(), // 도착예정일 (UTC epoch ms)
  arvDt: z.number().int().nullable(), // 창고 도착일 (UTC epoch ms)
  prodList: z.array(inboundSkuSchema), // 제품 목록(SKU LIST)
  prodQty: z.number().int().nonnegative(), // 제품 전체 수량
  contactName: z.string().nullable(), // 고객명
  contactTel: z.string().nullable(), // 고객연락처
  dataId: z.string(), // 입고 아이디 (WMS 고유 아이디)
  dataRegDt: z.number().int().nullable(), // 입고 정보 생성일 (UTC epoch ms)
  dataUpdDt: z.number().int().nullable(), // 입고 정보 변경일 (UTC epoch ms)
  regDt: z.number().int(), // FBR 시스템 정보 등록일 (UTC epoch ms)
  updDt: z.number().int().nullable(), // FBR 시스템 정보 변경일 (UTC epoch ms)
});
export type Inbound = z.infer<typeof inboundSchema>;

/**
 * searchDt(기준일자) 코드 — 목록 Req의 searchDt로 보내는 값(사용자 확인 확정):
 * 입고접수일=REQ_DT, 창고도착일=WRHS_DT, 입고완료일=CMPL_DT.
 * ※ CMPL_DT(입고완료일)는 검색 기준으로는 존재하지만 응답에 대응하는 완료일 필드가 없다 —
 * 응답 스키마 재확인 대상(CLAUDE.md TBD). 목 필터는 완료 행의 마지막 변경 시각으로 근사한다.
 */
export const INBOUND_DATE_FIELD = ["REQ_DT", "WRHS_DT", "CMPL_DT"] as const;
export type InboundDateField = (typeof INBOUND_DATE_FIELD)[number];
export const INBOUND_DATE_FIELD_LABEL: Record<InboundDateField, string> = {
  REQ_DT: "입고접수일",
  WRHS_DT: "창고도착일",
  CMPL_DT: "입고완료일",
};

/**
 * 목록 검색 파라미터 — URL 쿼리(프런트 계약)는 기존 이름을 유지하고, Req 필드로의 변환은
 * Phase 2 BFF가 담당한다: dateFrom/dateTo → startDt/endDt(epoch), dateField → searchDt,
 * keyword → search, page → pageNo(0-base), pageSize → pageSize.
 * startDt/endDt는 날짜+시:분 정밀도의 datetime(사용자 확인, 예시 epoch 10자리=초 단위) —
 * 검색 패널도 datetime-local(분 단위)로 받는다.
 * Req에 클라이언트·국가 파라미터는 없다 — 입고 목록의 운영자 필터는 WMS LINK만 노출한다
 * (CLAUDE.md TBD였던 항목이 입고 화면에 한해 해소됨).
 */
export const inboundSearchParamsSchema = baseSearchParamsSchema.extend({
  // 잘못된 값이 URL로 들어와도 전체 파싱이 깨지지 않게 해당 필드만 무시한다(catch → undefined).
  dateField: z.enum(INBOUND_DATE_FIELD).optional().catch(undefined),
  status: inboundStatusFilterSchema.optional().catch(undefined),
});
export type InboundSearchParams = z.infer<typeof inboundSearchParamsSchema>;
