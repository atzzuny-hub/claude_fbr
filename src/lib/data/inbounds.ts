import type { Inbound, InboundSearchParams, Paginated } from "@/types";
import { mockInbounds } from "@/lib/mock/inbounds";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

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
  return paginate(filtered, params.page, params.pageSize);
}

export async function getInbound(id: string): Promise<Inbound | null> {
  await delay();
  const session = await getSession();
  const row = inbounds.find((r) => r.id === id) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT" && row.clientId !== session.clientId) return null;
  return row;
}
