import { z } from "zod";
import { countryLabel, wireEpochToMs, wireTextToNull } from "./common";
import {
  OUTBOUND_DELIVERY,
  OUTBOUND_STATUS,
  outboundDeliveryFilterSchema,
  outboundDeliverySchema,
  outboundStatusFilterSchema,
  outboundStatusSchema,
  type OutboundDelivery,
} from "./status";

/**
 * Outbound (출고) — 출고 목록 API(GET /dtob) 응답 스키마 그대로(로컬 Swagger
 * DataOutboundRes 확인 2026-08-06, 필드명 변경 금지). 입고(types/inbound.ts)와 동일한
 * 계약 구조: 도메인 모델의 날짜류는 전부 UTC(+00:00) epoch 밀리초 — 와이어(초·0·문서 밖
 * 상태)는 wireOutboundSchema → toDomainOutbound가 ms·null·확정 enum으로 정규화한다.
 *
 * 입고와 다른 점(Swagger 확정):
 *  - 상태 축이 둘: status(출고상태) + delivery(배송상태, nullable — 배송 단계 전이면 없음).
 *  - Req(DataOutboundSearchReq)의 status·delivery 필터는 **배열**(다중 선택 — 입고는 단일).
 *  - searchDt는 ORDER_DT(주문일) | DELIVERY_DT(배송일) 2종(Req 스키마 enum으로 확정).
 *  - 금액 5종(double)·receiver(배송지)·marketName 등 커머스 필드 포함.
 *  - prodList는 Swagger 문서와 다른 실측 스키마(전 필드 nullable — outboundProductSchema
 *    주석 참조. 문서 오류 확정 2026-08-06).
 *
 * 응답에 클라이언트 ID가 없는 것(clntName뿐), cntyCd가 문서 밖 국가(SG 전례)를 줄 수 있는 것,
 * CLIENT 격리가 서버 스코핑 전제인 것은 입고와 동일하다.
 */

/** 제품 목록 한 줄 — ⚠️ Swagger 문서의 Product {sku, barcode, name}은 **문서 오류**(실측
 * 확정 2026-08-06, CLAUDE.md prodList 항목): 실제 응답 라인은 아래 필드 구성이다(name이
 * 아니라 productName). idx·barcode 등이 null인 라인이 실재해 **전 필드 nullable** — 한 줄의
 * 결측이 목록 전체 오류(502)가 되지 않게 한다. bundleItemList(실측에서 null만 관찰)는
 * 미모델링 — 도메인 변환에서 잘리고 BFF Res 원문 중계에는 남는다(입고 sipDt 취급).
 * 백엔드에 Swagger 갱신 요청 필요. */
export const outboundProductSchema = z.object({
  idx: z.number().int().nullable(), // 라인 고유 번호
  sku: z.string().nullable(), // SKU
  barcode: z.string().nullable(), // Barcode
  qty: z.number().int().nullable(), // 수량
  productName: z.string().nullable(), // 제품명
  productNameKr: z.string().nullable(), // 제품명(한국어)
  // 가상 상품 여부 — 실측 기록에 값 타입이 남아 있지 않아 boolean 추정. 와이어에서 boolean이
  // 아닌 값이 오면 toDomainOutbound가 warn 후 null로 강등한다(미확정 status의 UNKNOW 강등과
  // 같은 관례 — 실측 타입 확보 시 스키마로 승격).
  virtualProd: z.boolean().nullable(),
  // 금액류(double) — 행 금액과 동일하게 0도 유효값이라 0→null 변환은 하지 않는다.
  productPrice: z.number().nullable(), // 단가
  totalAmount: z.number().nullable(), // 라인 총 금액
  actualAmount: z.number().nullable(), // 라인 실제 금액
  codAmount: z.number().nullable(), // 라인 COD 금액
});
export type OutboundProduct = z.infer<typeof outboundProductSchema>;

/** 배송지 정보(Swagger Receiver — 객체 자체가 nullable). 필드들은 문서에 nullable 표기가
 * 없지만 주소·연락처류는 값이 없는 행이 실재할 수밖에 없어 방어적으로 nullable로 모델링한다
 * (입고의 contactName/contactTel과 같은 표시 계열 — 화면은 "—" 폴백). */
export const outboundReceiverSchema = z.object({
  country: z.string().nullable(), // 국가 코드
  name: z.string().nullable(), // 받는 사람 이름
  addr: z.string().nullable(), // 받는 사람 주소
  billAddr: z.string().nullable(), // 청구 주소
  zipCode: z.string().nullable(), // 우편번호
  tel: z.string().nullable(), // 일반 전화번호
  mobile: z.string().nullable(), // 휴대전화번호
});
export type OutboundReceiver = z.infer<typeof outboundReceiverSchema>;

export const outboundSchema = z.object({
  idx: z.number().int(), // IDX — 행 고유 번호(int64)
  wmsId: z.number().int(), // WMS ID
  wmsLinkId: z.number().int(), // WMS LINK ID
  wmsLinkName: z.string(), // WMS LINK Name (예: ETON 01)
  clntName: z.string().nullable(), // 클라이언트 이름
  ganNo: z.string().nullable(), // 접수번호 (마켓주문번호/클라이언트 관리번호 등)
  // 국가코드 — 입고와 같은 이유로 확정 enum이 아니라 열린 문자열(SG 전례 — 문서 밖 국가가
  // 와도 목록이 깨지면 안 된다). 표시는 countryLabel() 폴백.
  cntyCd: z.string(),
  marketName: z.string().nullable(), // 주문 마켓이름 (예: Shopee)
  orderDt: z.number().int().nullable(), // 주문일 (UTC epoch ms)
  statusOriginalCode: z.string().nullable(), // 출고상태 원본 코드(WMS 원문)
  status: outboundStatusSchema, // 출고상태 (PEND | PICK | PACK | COMPLETED | CANCELED | HOLDED | RETURNED | P_RETURNED | UNKNOW)
  deliveryOriginalCode: z.string().nullable(), // 배송상태 원본 코드(WMS 원문)
  delivery: outboundDeliverySchema.nullable(), // 배송상태 — 배송 단계 전이면 null
  // 출고상태 변경일 (UTC epoch ms) — 문서상 non-null이지만 값 없음 = 0 와이어 전례(입고
  // reqDt/regDt 실측)에 대비해 nullable로 모델링한다(아래 regDt 동일).
  releaseDt: z.number().int().nullable(),
  deliveryDt: z.number().int().nullable(), // 배송상태 변경일 (UTC epoch ms)
  prodList: z.array(outboundProductSchema), // 제품 목록
  transporter: z.string().nullable(), // 배송방식(택배사 등)
  trackingNo: z.string().nullable(), // 추적번호
  receiver: outboundReceiverSchema.nullable(), // 배송지 정보
  dataId: z.string(), // 출고 아이디 (WMS 고유 아이디)
  totalAmount: z.number(), // 총 금액 (double — 0도 유효값이라 null 변환하지 않는다)
  promotionAmount: z.number(), // 프로모션 금액
  actualAmount: z.number(), // 실제 금액
  totalCodAmount: z.number(), // 총 COD 금액
  finalCodAmount: z.number(), // 최종 COD 금액
  businessType: z.string().nullable(), // 비지니스 형식 (예: B2C, B2B)
  dataRegDt: z.number().int().nullable(), // 출고 정보 생성일 (UTC epoch ms)
  dataUpdDt: z.number().int().nullable(), // 출고 정보 변경일 (UTC epoch ms)
  regDt: z.number().int().nullable(), // FBR 시스템 정보 등록일 (UTC epoch ms)
  updDt: z.number().int().nullable(), // FBR 시스템 정보 변경일 (UTC epoch ms)
});
export type Outbound = z.infer<typeof outboundSchema>;

// ── 와이어(Res 원문) ↔ 도메인 변환 ─────────────────────────────────
// 입고에서 확정한 계약(2026-08-05)을 그대로 계승한다: BFF는 Java Res를 배열 그대로
// 중계하고, 실측 확정된 와이어 특성(① 날짜 epoch "초" ② 값 없음 0 ③ 문서 밖 상태 실재
// 전례 — 입고 WORK)의 정규화는 받는 쪽(화면·lib/data)이 공용 변환으로 수행한다.

/** 와이어 제품 라인 스키마 — 결측이 null·키 생략 어느 쪽으로 와도 라인 하나 때문에 목록이
 * 죽지 않게 전부 nullish로 받는다(도메인 변환이 null로 정규화). virtualProd는 타입 실측이
 * 없어 unknown으로 받고 변환에서 boolean만 채택한다. bundleItemList는 미선언 — zod 기본
 * strip으로 도메인 변환에서 잘린다(BFF 원문 중계에는 남음). */
export const wireOutboundProductSchema = z.object({
  idx: z.number().int().nullish(),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  qty: z.number().int().nullish(),
  productName: z.string().nullish(),
  productNameKr: z.string().nullish(),
  virtualProd: z.unknown().optional(), // .optional() — zod는 unknown도 키 생략은 별도 허용이 필요하다
  productPrice: z.number().nullish(),
  totalAmount: z.number().nullish(),
  actualAmount: z.number().nullish(),
  codAmount: z.number().nullish(),
});
export type WireOutboundProduct = z.infer<typeof wireOutboundProductSchema>;

/** 와이어 라인 → 도메인 라인 — 키 생략·빈 문자열을 null로 정규화, virtualProd는 boolean만
 * 채택(그 외 타입은 warn 후 null — 로그로 실제 타입을 발견하면 스키마로 승격한다). */
function toDomainOutboundProduct(line: WireOutboundProduct, rowIdx: number): OutboundProduct {
  let virtualProd: boolean | null = null;
  if (typeof line.virtualProd === "boolean") {
    virtualProd = line.virtualProd;
  } else if (line.virtualProd != null) {
    console.warn(`[outbound] virtualProd 비불리언 값(${typeof line.virtualProd}) (행 idx ${rowIdx}) — null로 표시`);
  }
  return {
    idx: line.idx ?? null,
    sku: wireTextToNull(line.sku ?? null),
    barcode: wireTextToNull(line.barcode ?? null),
    qty: line.qty ?? null,
    productName: wireTextToNull(line.productName ?? null),
    productNameKr: wireTextToNull(line.productNameKr ?? null),
    virtualProd,
    productPrice: line.productPrice ?? null,
    totalAmount: line.totalAmount ?? null,
    actualAmount: line.actualAmount ?? null,
    codAmount: line.codAmount ?? null,
  };
}

/** 와이어 행 스키마 — status/delivery는 임의 문자열(→ toDomainOutbound에서 판정),
 * 문서상 non-null 날짜(releaseDt/regDt)는 0 허용 non-null로 되돌리고, prodList는
 * 실측 라인 스키마(전 필드 nullish)로 받는다. */
export const wireOutboundSchema = outboundSchema.extend({
  status: z.string(),
  delivery: z.string().nullable(),
  releaseDt: z.number().int(),
  regDt: z.number().int(),
  prodList: z.array(wireOutboundProductSchema),
});
export type WireOutbound = z.infer<typeof wireOutboundSchema>;

/** 와이어 행 → 도메인 행 — 날짜 초→ms·0→null, 빈 문자열→null(공용 헬퍼), 모르는
 * status/delivery는 UNKNOW 강등(입고 WORK 전례 — 표시명 확정 전까지 로그로 발견). */
export function toDomainOutbound(wire: WireOutbound): Outbound {
  const statusKnown = (OUTBOUND_STATUS as readonly string[]).includes(wire.status);
  if (!statusKnown) {
    console.warn(`[outbound] 미확정 출고상태 "${wire.status}" (idx ${wire.idx}) — UNKNOW로 표시`);
  }
  // delivery는 nullable — 값 없음(null·"")은 그대로 null, 모르는 값만 UNKNOW 강등.
  const deliveryText = wireTextToNull(wire.delivery);
  const deliveryKnown = deliveryText !== null && (OUTBOUND_DELIVERY as readonly string[]).includes(deliveryText);
  if (deliveryText !== null && !deliveryKnown) {
    console.warn(`[outbound] 미확정 배송상태 "${deliveryText}" (idx ${wire.idx}) — UNKNOW로 표시`);
  }
  return {
    ...wire,
    status: statusKnown ? (wire.status as Outbound["status"]) : "UNKNOW",
    delivery: deliveryText === null ? null : deliveryKnown ? (deliveryText as OutboundDelivery) : "UNKNOW",
    prodList: wire.prodList.map((line) => toDomainOutboundProduct(line, wire.idx)),
    statusOriginalCode: wireTextToNull(wire.statusOriginalCode),
    deliveryOriginalCode: wireTextToNull(wire.deliveryOriginalCode),
    ganNo: wireTextToNull(wire.ganNo),
    clntName: wireTextToNull(wire.clntName),
    marketName: wireTextToNull(wire.marketName),
    transporter: wireTextToNull(wire.transporter),
    trackingNo: wireTextToNull(wire.trackingNo),
    businessType: wireTextToNull(wire.businessType),
    receiver: wire.receiver
      ? {
          country: wireTextToNull(wire.receiver.country),
          name: wireTextToNull(wire.receiver.name),
          addr: wireTextToNull(wire.receiver.addr),
          billAddr: wireTextToNull(wire.receiver.billAddr),
          zipCode: wireTextToNull(wire.receiver.zipCode),
          tel: wireTextToNull(wire.receiver.tel),
          mobile: wireTextToNull(wire.receiver.mobile),
        }
      : null,
    orderDt: wireEpochToMs(wire.orderDt),
    releaseDt: wireEpochToMs(wire.releaseDt),
    deliveryDt: wireEpochToMs(wire.deliveryDt),
    dataRegDt: wireEpochToMs(wire.dataRegDt),
    dataUpdDt: wireEpochToMs(wire.dataUpdDt),
    regDt: wireEpochToMs(wire.regDt),
    updDt: wireEpochToMs(wire.updDt),
  };
}

/**
 * 정렬 값 접근자 — sort 키(= 목록 컬럼 key)별 비교 기준값. 입고와 동일하게 Req에 정렬
 * 파라미터가 없다는 전제로 받은 페이지 안에서만 재정렬한다(프런트 전용 sort/order).
 * ※ 키 목록은 잠정 — 출고 화면(컬럼) 조립 시 실제 컬럼 key와 맞춘다.
 *  - status/delivery: 파이프라인(enum) 순서 = 인덱스. delivery 없음(null)은 뒤로.
 *  - country: 화면에 보이는 한글 국가명 기준(모르는 코드는 코드 그대로).
 *  - 날짜류: epoch(ms) 수치 비교. 없는 값(null)은 sortItems가 항상 뒤로 보낸다.
 *  - 모르는 키: null → 정렬 안 함(원본 순서 유지).
 */
export function outboundSortValue(row: Outbound, key: string): string | number | null {
  switch (key) {
    case "ganNo":
      return row.ganNo;
    case "status":
      return OUTBOUND_STATUS.indexOf(row.status);
    case "delivery":
      return row.delivery === null ? null : OUTBOUND_DELIVERY.indexOf(row.delivery);
    case "country":
      return countryLabel(row.cntyCd);
    case "wmsLink":
      return row.wmsLinkName;
    case "market":
      return row.marketName;
    case "orderDt":
      return row.orderDt;
    case "releaseDt":
      return row.releaseDt;
    case "deliveryDt":
      return row.deliveryDt;
    default:
      return null;
  }
}

/**
 * searchDt(기준일자) 코드 — 목록 Req의 searchDt로 보내는 값. 입고와 달리 Req 스키마의
 * enum으로 확정돼 있다(Swagger 2026-08-06): 주문일 ORDER_DT · 배송일 DELIVERY_DT.
 * 한국어 라벨도 Swagger description 표기("ORDER_DT:주문일, DELIVERY_DT:배송일") 그대로.
 */
export const OUTBOUND_DATE_FIELD = ["ORDER_DT", "DELIVERY_DT"] as const;
export type OutboundDateField = (typeof OUTBOUND_DATE_FIELD)[number];
export const OUTBOUND_DATE_FIELD_LABEL: Record<OutboundDateField, string> = {
  ORDER_DT: "주문일",
  DELIVERY_DT: "배송일",
};

/**
 * 목록 검색 파라미터(프런트 계약) — 필드명·의미를 Java Req(DataOutboundSearchReq)와
 * 그대로 통일한다(입고에서 확정한 관례): wmsLinkId·startDt/endDt(epoch 초)·searchDt·
 * status·delivery·search·pageNo(0-기반)·pageSize. sort/order만 Req에 없는 프런트 전용.
 * 필수 표기(Swagger): wmsLinkId·startDt·endDt·searchDt·pageNo·pageSize — 빈 값 기본치는
 * lib/data가 채운다(입고와 동일: 전체 WMS LINK = -100 센티널·최광역 기간, 실연동 시 검증).
 * ※ status·delivery는 배열(다중 선택) — 단일 값이던 입고와 다른 부분. BFF 쿼리 직렬화
 *   방식(반복 파라미터 등)은 출고 BFF 조립 시 확정한다.
 */
export const outboundSearchParamsSchema = z.object({
  wmsLinkId: z.string().optional(), // select 값(수치 ID 문자열) — 전체는 String(WMS_LINK_ALL)
  startDt: z.coerce.number().int().positive().optional().catch(undefined), // epoch 초(UTC)
  endDt: z.coerce.number().int().positive().optional().catch(undefined), // epoch 초(UTC)
  searchDt: z.enum(OUTBOUND_DATE_FIELD).optional().catch(undefined),
  status: z.array(outboundStatusFilterSchema).optional().catch(undefined), // Req: 배열(다중 선택)
  delivery: z.array(outboundDeliveryFilterSchema).optional().catch(undefined), // Req: 배열(다중 선택)
  search: z.string().optional(),
  sort: z.string().optional(), // 프런트 전용(Req에 없음)
  order: z.enum(["asc", "desc"]).optional().catch(undefined), // 프런트 전용(Req에 없음)
  pageNo: z.coerce.number().int().min(0).optional().catch(undefined), // 0-기반(Req 확정)
  pageSize: z.coerce.number().int().min(1).optional().catch(undefined),
});
export type OutboundSearchParams = z.infer<typeof outboundSearchParamsSchema>;
