import { COUNTRY_LABEL, INBOUND_STATUS, type Inbound, type InboundSearchParams, type Paginated } from "@/types";
import { mockInbounds } from "@/lib/mock/inbounds";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, sortItems, withinDateRange } from "./utils";

/**
 * Inbound (입고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F001/F012/F013).
 * dateField 허용값: "receiptDate"(입고접수일, 기본) | "arrivalDate"(창고도착일) | "completedDate"(입고 완료일).
 * 아직 도착/완료되지 않은 행은 그 날짜가 null이므로 해당 기준일자로 기간 검색하면 결과에서 빠진다.
 */
const inbounds: Inbound[] = [...mockInbounds];

function resolveDate(row: Inbound, dateField?: string): string | null {
  switch (dateField) {
    case "arrivalDate":
      return row.arrivalDate;
    case "completedDate":
      return row.completedDate;
    case "receiptDate":
    default:
      return row.receiptDate;
  }
}

/**
 * 정렬 값 접근자 — sort 키(= 목록 컬럼 key)별 비교 기준값을 돌려준다.
 *  - status: 파이프라인 순서(예정→대기→입고)로 정렬되게 enum 인덱스를 쓴다(알파벳순이 아니라).
 *  - country: 화면에 보이는 한글 국가명 기준(사용자가 보는 순서와 일치).
 *  - 날짜 3종: 아직 없는 값(null)은 sortItems가 항상 뒤로 보낸다.
 *  - 모르는 키: null → 정렬 안 함(원본 순서 유지).
 */
function inboundSortValue(row: Inbound, key: string): string | number | null {
  switch (key) {
    case "orderNo":
      return row.orderNo;
    case "receiptNo":
      return row.receiptNo;
    case "status":
      return INBOUND_STATUS.indexOf(row.status);
    case "country":
      return COUNTRY_LABEL[row.country];
    case "wmsLink":
      return row.wmsLinkName;
    case "receiptDate":
      return row.receiptDate;
    case "arrivalDate":
      return row.arrivalDate;
    case "completedDate":
      return row.completedDate;
    default:
      return null;
  }
}

export async function getInbounds(params: InboundSearchParams = {}): Promise<Paginated<Inbound>> {
  await delay();
  const session = await getSession();
  const scopedClientId = resolveClientScope(session, params.clientId);

  const filtered = inbounds.filter((row) => {
    if (scopedClientId && row.clientId !== scopedClientId) return false;
    if (params.wmsLinkId && row.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && row.country !== params.country) return false;
    if (params.status && row.status !== params.status) return false;
    if (!withinDateRange(resolveDate(row, params.dateField), params.dateFrom, params.dateTo)) return false;
    if (
      !matchesKeyword(
        params.keyword,
        row.orderNo,
        row.receiptNo,
        row.skuCode,
        row.skuName,
        row.clientName,
      )
    ) {
      return false;
    }
    return true;
  });
  const sorted = sortItems(filtered, params.sort, params.order, inboundSortValue);
  return paginate(sorted, params.page, params.pageSize);
}

export async function getInbound(id: string): Promise<Inbound | null> {
  await delay();
  const session = await getSession();
  const row = inbounds.find((r) => r.id === id) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT" && row.clientId !== session.clientId) return null;
  return row;
}
