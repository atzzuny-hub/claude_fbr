import type { Inbound, InboundSearchParams, Paginated } from "@/types";
import { mockInbounds } from "@/lib/mock/inbounds";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

/**
 * Inbound (입고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F001/F012/F013).
 * dateField 허용값: "createdAt" | "expectedDate"(기본) | "receivedDate".
 */
const inbounds: Inbound[] = [...mockInbounds];

function resolveDate(row: Inbound, dateField?: string): string | null {
  switch (dateField) {
    case "createdAt":
      return row.createdAt;
    case "receivedDate":
      return row.receivedDate;
    case "expectedDate":
    default:
      return row.expectedDate;
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
    if (!matchesKeyword(params.keyword, row.referenceNo, row.skuCode, row.skuName, row.clientName)) return false;
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
