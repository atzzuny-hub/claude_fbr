import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";
import { inboundStatusSchema } from "./status";

/**
 * Inbound (입고) — 클라이언트 소유 + 물류 모델 → clientId, country, wmsLinkId 필수.
 *
 * 번호 2종 · 날짜 3종은 입고 진행 단계와 1:1로 대응한다 (목록 컬럼과 기준일자 후보):
 *  - orderNo(주문번호)   : 클라이언트가 발주에 쓰는 번호
 *  - receiptNo(접수번호) : 입고 요청을 접수할 때 발급되는 번호
 *  - receiptDate(입고접수일)  : 접수 시점 — 항상 존재
 *  - arrivalDate(창고도착일)  : 현지 창고 도착 시점 — 예정 단계에서는 null
 *  - completedDate(입고 완료일): 입고 처리 완료 시점 — 입고 단계에서만 값이 있다
 * 세 시점은 날짜만이 아니라 시각까지 담는다(날짜시간). 기간 검색은 앞 10자(날짜)만 비교하므로
 * 시각이 붙어도 필터 동작은 그대로다(lib/data/utils.ts의 withinDateRange).
 * 상태(예정 → 대기 → 입고)와의 관계: 예정=접수만, 대기=도착까지, 입고=완료까지.
 * 필드명은 Swagger 확인 전까지 잠정(CLAUDE.md TBD).
 */
export const inboundSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  skuId: z.string(),
  skuCode: z.string(),
  skuName: z.string(),
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  status: inboundStatusSchema,
  orderNo: z.string(),
  receiptNo: z.string(),
  quantity: z.number().int().nonnegative(),
  receiptDate: z.iso.datetime(),
  arrivalDate: z.iso.datetime().nullable(),
  completedDate: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Inbound = z.infer<typeof inboundSchema>;

export const inboundSearchParamsSchema = baseSearchParamsSchema.extend({
  status: inboundStatusSchema.optional(),
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type InboundSearchParams = z.infer<typeof inboundSearchParamsSchema>;
