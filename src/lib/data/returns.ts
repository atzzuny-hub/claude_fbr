import type { Paginated, Return, ReturnSearchParams } from "@/types";
import { mockReturns } from "@/lib/mock/returns";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

/**
 * Return (반품현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F003/F012/F013).
 * dateField 허용값: "createdAt" | "requestedDate"(기본) | "completedDate".
 */
const returns: Return[] = [...mockReturns];

function resolveDate(row: Return, dateField?: string): string | null {
  switch (dateField) {
    case "createdAt":
      return row.createdAt;
    case "completedDate":
      return row.completedDate;
    case "requestedDate":
    default:
      return row.requestedDate;
  }
}

export async function getReturns(params: ReturnSearchParams = {}): Promise<Paginated<Return>> {
  await delay();
  const session = await getSession();
  const scopedClientId = resolveClientScope(session, params.clientId);

  const filtered = returns.filter((row) => {
    if (scopedClientId && row.clientId !== scopedClientId) return false;
    if (params.wmsLinkId && row.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && row.country !== params.country) return false;
    if (params.status && row.status !== params.status) return false;
    if (!withinDateRange(resolveDate(row, params.dateField), params.dateFrom, params.dateTo)) return false;
    if (!matchesKeyword(params.keyword, row.referenceNo, row.skuCode, row.skuName, row.clientName, row.reason)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getReturn(id: string): Promise<Return | null> {
  await delay();
  const session = await getSession();
  const row = returns.find((r) => r.id === id) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT" && row.clientId !== session.clientId) return null;
  return row;
}
