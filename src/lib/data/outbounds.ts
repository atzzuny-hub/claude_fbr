import type { Outbound, OutboundSearchParams, Paginated } from "@/types";
import { mockOutbounds } from "@/lib/mock/outbounds";
import { canAccessClient, requireSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

/**
 * Outbound (출고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F002/F012/F013).
 * dateField 허용값: "createdAt" | "orderDate"(기본) | "shippedDate".
 */
const outbounds: Outbound[] = [...mockOutbounds];

function resolveDate(row: Outbound, dateField?: string): string | null {
  switch (dateField) {
    case "createdAt":
      return row.createdAt;
    case "shippedDate":
      return row.shippedDate;
    case "orderDate":
    default:
      return row.orderDate;
  }
}

export async function getOutbounds(params: OutboundSearchParams = {}): Promise<Paginated<Outbound>> {
  await delay();
  const session = await requireSession();
  const scopedClientIds = resolveClientScope(session, params.clientId);

  const filtered = outbounds.filter((row) => {
    if (scopedClientIds && !scopedClientIds.includes(row.clientId)) return false;
    if (params.wmsLinkId && row.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && row.country !== params.country) return false;
    if (params.status && row.status !== params.status) return false;
    if (!withinDateRange(resolveDate(row, params.dateField), params.dateFrom, params.dateTo)) return false;
    if (!matchesKeyword(params.keyword, row.referenceNo, row.skuCode, row.skuName, row.clientName)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getOutbound(id: string): Promise<Outbound | null> {
  await delay();
  const session = await requireSession();
  const row = outbounds.find((r) => r.id === id) ?? null;
  if (!row) return null;
  if (!canAccessClient(session, row.clientId)) return null;
  return row;
}
