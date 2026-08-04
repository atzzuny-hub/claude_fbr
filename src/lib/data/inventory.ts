import type { InventoryItem, InventorySearchParams, Paginated } from "@/types";
import { mockInventoryItems } from "@/lib/mock/inventory";
import { canAccessClient, requireSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

/**
 * InventoryItem (재고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F004/F012/F013).
 * dateField는 updatedAt(재고 기준 시각) 단일 필드만 존재.
 */
const inventoryItems: InventoryItem[] = [...mockInventoryItems];

export async function getInventoryItems(
  params: InventorySearchParams = {},
): Promise<Paginated<InventoryItem>> {
  await delay();
  const session = await requireSession();
  const scopedClientIds = resolveClientScope(session, params.clientId);

  const filtered = inventoryItems.filter((row) => {
    if (scopedClientIds && !scopedClientIds.includes(row.clientId)) return false;
    if (params.wmsLinkId && row.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && row.country !== params.country) return false;
    if (!withinDateRange(row.updatedAt, params.dateFrom, params.dateTo)) return false;
    if (!matchesKeyword(params.keyword, row.skuCode, row.skuName, row.clientName)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  await delay();
  const session = await requireSession();
  const row = inventoryItems.find((r) => r.id === id) ?? null;
  if (!row) return null;
  if (!canAccessClient(session, row.clientId)) return null;
  return row;
}
