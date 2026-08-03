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
/**
 * 입고 상품 라인 — 한 건의 입고에 실제로 들어온 상품 목록(행 확장 상세에서 표로 보여준다).
 *  - totalQuantity(입고 전체수량): 접수된 수량
 *  - availableQuantity(사용가능수량): 검수 후 실제 사용 가능한 수량
 *  - errorQuantity(오류수량): 불량/오류로 빠진 수량. 아직 확인 전이면 null → 화면엔 "—"
 * 상품명은 표시용 영문/한글 두 가지를 함께 담는다(목록 상세의 상품명·상품명(한글) 컬럼).
 */
export const inboundLineSchema = z.object({
  id: z.string(),
  skuCode: z.string(),
  productName: z.string(), // 상품명 (영문 표기)
  productNameKo: z.string(), // 상품명(한글)
  unit: z.string(),
  totalQuantity: z.number().int().nonnegative(),
  availableQuantity: z.number().int().nonnegative(),
  errorQuantity: z.number().int().nonnegative().nullable(),
});
export type InboundLine = z.infer<typeof inboundLineSchema>;

export const inboundSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  // 고객명·연락처 — 행 확장 상세 상단에 표시(입고 요청 담당 고객). 클라이언트(마켓)와는 별개.
  customerName: z.string(),
  customerContact: z.string(),
  skuId: z.string(),
  skuCode: z.string(),
  skuName: z.string(),
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  status: inboundStatusSchema,
  orderNo: z.string(),
  receiptNo: z.string(),
  // 총 입고수량 = lines의 totalQuantity 합(상세 합계·CSV 수량과 일치).
  quantity: z.number().int().nonnegative(),
  // 입고 상품 라인(1건 이상). 상세 상품 리스트·합계의 출처.
  lines: z.array(inboundLineSchema),
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
