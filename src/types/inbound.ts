import { z } from "zod";
import { countryLabel } from "./common";
import { INBOUND_STATUS, inboundStatusFilterSchema, inboundStatusSchema } from "./status";

/**
 * Inbound (입고) — 입고 목록 API 응답 스키마 그대로(Swagger 확정, 필드명 변경 금지).
 * 이 도메인 모델의 날짜류는 전부 UTC(+00:00) epoch 밀리초(integer) — 표시할 때는
 * lib/utils/datetime의 formatEpoch* 계열을 쓴다(문자열 파싱 금지).
 * ※ 실서버 와이어(실측 2026-08-05)는 문서 표기와 달리 epoch "초" · 값 없음 = 0 ·
 * 문서 밖 status(WORK 전례)가 올 수 있다 — 아래 wireInboundSchema → toDomainInbound가
 * ms·null·확정 enum으로 정규화해 이 모델을 채운다(BFF 응답이 Res 그대로의 배열이라
 * 정규화는 받는 쪽 공용 — 화면·lib/data가 공유). 목데이터·화면은 이 모델(ms) 전제 그대로다.
 *
 * 응답에 클라이언트 ID가 없다(clntName뿐) — CLIENT 데이터 격리는 서버(API/BFF)가 세션으로
 * 스코핑하는 전제다. Phase 1 목데이터 스코핑은 lib/data/inbounds.ts가 이름으로 잇는다.
 *
 * ※ Swagger 대비 우리 쪽에서 느슨하게 둔 부분:
 *  - etaDt/arvDt: 명세에 nullable 표기가 없지만 미도래 단계는 값이 없어야 정상이라
 *    nullable로 모델링 — 실측 확인됨(와이어는 0으로 주고, 정규화가 null로 바꾼다).
 *  - sipDt(배송일): 사용자 확정으로 제거(2026-08 "이제 안 씀") — 실제 응답에 남아
 *    있음(0) 확인, 무시한다(화면·CSV·목데이터 전부에서 뺌).
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
  // 국가코드 — 확정 enum이 아니라 열린 문자열: 실데이터에 문서 밖 국가가 실재했고(SG,
  // 2026-08-05 실측 후 정식 추가) 새 국가가 또 와도 목록이 깨지면 안 된다. 표시는
  // countryLabel()/CountryCell이 폴백(모르는 코드는 코드 그대로) 처리한다.
  cntyCd: z.string(),
  // 접수일 (UTC epoch ms) — 명세상 필수지만 실데이터에 0(=값 없음)인 행이 실재(WORK 행에서
  // 실측 2026-08-05). 와이어 정규화가 0→null로 바꾸므로 nullable로 모델링한다(regDt 동일).
  reqDt: z.number().int().nullable(),
  etaDt: z.number().int().nullable(), // 도착예정일 (UTC epoch ms)
  arvDt: z.number().int().nullable(), // 창고 도착일 (UTC epoch ms)
  prodList: z.array(inboundSkuSchema), // 제품 목록(SKU LIST)
  prodQty: z.number().int().nonnegative(), // 제품 전체 수량
  contactName: z.string().nullable(), // 고객명
  contactTel: z.string().nullable(), // 고객연락처
  dataId: z.string(), // 입고 아이디 (WMS 고유 아이디)
  dataRegDt: z.number().int().nullable(), // 입고 정보 생성일 (UTC epoch ms)
  dataUpdDt: z.number().int().nullable(), // 입고 정보 변경일 (UTC epoch ms)
  regDt: z.number().int().nullable(), // FBR 시스템 정보 등록일 (UTC epoch ms) — reqDt와 같은 이유로 nullable
  updDt: z.number().int().nullable(), // FBR 시스템 정보 변경일 (UTC epoch ms)
});
export type Inbound = z.infer<typeof inboundSchema>;

// ── 와이어(Res 원문) ↔ 도메인 변환 ─────────────────────────────────
// BFF(GET /api/inbounds)는 Java Res를 **배열 그대로** 중계한다(사용자 확정 2026-08-05 —
// devtools에서 보이는 응답이 곧 Res). 실측 확정된 와이어 특성(① 날짜 epoch "초" ② 값 없음 0
// ③ 문서 밖 status 실재 전례 — WORK는 이후 정식 편입)을 도메인 모델(ms·null·확정 enum)로
// 바꾸는 정규화는 받는 쪽이 한다: 화면(axios 재조회)과 lib/data(SSR 초기 조회·검증)가 공유.

/** 와이어 행 스키마 — status는 임의 문자열(→ toDomainInbound에서 판정), 날짜는 0 허용 non-null. */
export const wireInboundSchema = inboundSchema.extend({
  status: z.string(),
  reqDt: z.number().int(),
  regDt: z.number().int(),
});
export type WireInbound = z.infer<typeof wireInboundSchema>;

/** epoch 초 → ms. 0 = 값 없음(실측: 미도래 단계) → null. */
function wireEpochToMs(sec: number | null): number | null {
  return sec ? sec * 1000 : null;
}

/** 와이어 행 → 도메인 행 — 날짜 초→ms·0→null, 모르는 status는 UNKNOW("알 수 없음")로 강등. */
export function toDomainInbound(wire: WireInbound): Inbound {
  const known = (INBOUND_STATUS as readonly string[]).includes(wire.status);
  if (!known) {
    // WORK 전례처럼 문서 밖 상태가 또 오면 — 표시명 확정 전까지 UNKNOW로 강등(로그로 발견).
    console.warn(`[inbound] 미확정 입고상태 "${wire.status}" (idx ${wire.idx}) — UNKNOW로 표시`);
  }
  return {
    ...wire,
    status: known ? (wire.status as Inbound["status"]) : "UNKNOW",
    reqDt: wireEpochToMs(wire.reqDt),
    etaDt: wireEpochToMs(wire.etaDt),
    arvDt: wireEpochToMs(wire.arvDt),
    dataRegDt: wireEpochToMs(wire.dataRegDt),
    dataUpdDt: wireEpochToMs(wire.dataUpdDt),
    regDt: wireEpochToMs(wire.regDt),
    updDt: wireEpochToMs(wire.updDt),
  };
}

/**
 * 정렬 값 접근자 — sort 키(= 목록 컬럼 key)별 비교 기준값. Req에 정렬 파라미터가 없어
 * 받은 페이지 안에서만 재정렬한다(프런트 전용 sort/order) — 화면과 목 경로가 공유.
 *  - status: 파이프라인 순서(예정→대기→작업중→입고→취소→알 수 없음) = enum 인덱스.
 *  - country: 화면에 보이는 한글 국가명 기준(모르는 코드는 코드 그대로).
 *  - 날짜 3종: epoch(ms) 수치 비교. 아직 없는 값(null)은 sortItems가 항상 뒤로 보낸다.
 *  - 모르는 키: null → 정렬 안 함(원본 순서 유지).
 */
export function inboundSortValue(row: Inbound, key: string): string | number | null {
  switch (key) {
    case "ganNo":
      return row.ganNo;
    case "status":
      return INBOUND_STATUS.indexOf(row.status);
    case "country":
      return countryLabel(row.cntyCd);
    case "wmsLink":
      return row.wmsLinkName;
    case "reqDt":
      return row.reqDt;
    case "etaDt":
      return row.etaDt;
    case "arvDt":
      return row.arvDt;
    default:
      return null;
  }
}

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
 * 목록 검색 파라미터(프런트 계약) — **필드명·의미를 Java Req(/dtin)와 그대로 통일**한다
 * (사용자 확정 2026-08-05): startDt/endDt(epoch 초)·searchDt·status·search·pageNo(0-기반)·
 * pageSize·wmsLinkId. devtools에서 보이는 GET /api/inbounds 쿼리가 곧 Java Req 모양이다.
 * sort/order만 Req에 없는 프런트 전용(응답 페이지 내 재정렬 — 사용자 인정).
 *
 * 화면 검색 상태(InboundScreen)이자 데이터 BFF(GET /api/inbounds) 쿼리의 검증 스키마 —
 * 검색 조건은 URL에 싣지 않는다(원칙 6, URL은 /inbound 고정). 날짜 입력("YYYY-MM-DD") →
 * epoch 초 변환은 화면(toEpochSeconds, 시작 00:00:00 · 종료 23:59:59 UTC)이 하고,
 * lib/data는 빈 값 기본치(-100 · 최광역 기간 · REQ_DT)만 채운다.
 * Req에 클라이언트·국가 파라미터는 없다 — 입고 목록의 운영자 필터는 WMS LINK만 노출한다
 * (CLAUDE.md TBD였던 항목이 입고 화면에 한해 해소됨).
 */
/**
 * 전체 WMS LINK 조회 센티널 — 레거시 요청 캡처로 확정(2026-08-05). Req에서 wmsLinkId를
 * 아예 빼면 에러가 아니라 **조용히 0건**이 온다(실서버 프로브) — 함정이므로 프런트가
 * 미선택(전체)일 때부터 -100을 항상 실어 보낸다(브라우저→BFF 쿼리도 Req와 같은 모양).
 */
export const WMS_LINK_ALL = -100;

export const inboundSearchParamsSchema = z.object({
  // BFF 쿼리(문자열)와 화면 상태(숫자)를 한 스키마로 받기 위해 수치는 coerce —
  // 잘못된 값이 와도 전체 파싱이 깨지지 않게 해당 필드만 무시한다(catch → undefined).
  wmsLinkId: z.string().optional(), // select 값(수치 ID 문자열) — 전체는 String(WMS_LINK_ALL)
  startDt: z.coerce.number().int().positive().optional().catch(undefined), // epoch 초(UTC)
  endDt: z.coerce.number().int().positive().optional().catch(undefined), // epoch 초(UTC)
  searchDt: z.enum(INBOUND_DATE_FIELD).optional().catch(undefined),
  status: inboundStatusFilterSchema.optional().catch(undefined),
  search: z.string().optional(),
  sort: z.string().optional(), // 프런트 전용(Req에 없음)
  order: z.enum(["asc", "desc"]).optional().catch(undefined), // 프런트 전용(Req에 없음)
  pageNo: z.coerce.number().int().min(0).optional().catch(undefined), // 0-기반(Req 확정)
  pageSize: z.coerce.number().int().min(1).optional().catch(undefined),
});
export type InboundSearchParams = z.infer<typeof inboundSearchParamsSchema>;
