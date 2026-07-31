import type { Paginated, Sku, SkuInput, SkuSearchParams } from "@/types";
import { mockClients } from "@/lib/mock/clients";
import { mockSkus } from "@/lib/mock/skus";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

/**
 * Sku (SKU) — 클라이언트 소유 모델, 역할 스코핑 대상(F013).
 * ⚠️ Sku 엔티티 자체에는 country/wmsLinkId 필드가 없다(types/sku.ts 상단 주석의 PRD
 * 잠정 가정). 검색 패널의 국가/WMS LINK 필터는 clientId를 경유해 소속 클라이언트의
 * country/wmsLinkId로 조인 필터링한다.
 */
let skus: Sku[] = [...mockSkus];

const clientsById = new Map(mockClients.map((client) => [client.id, client]));

function resolveDate(row: Sku, dateField?: string): string {
  if (dateField === "updatedAt") return row.updatedAt;
  return row.createdAt; // 기본 기준일자
}

export async function getSkus(params: SkuSearchParams = {}): Promise<Paginated<Sku>> {
  await delay();
  const session = await getSession();
  const scopedClientId = resolveClientScope(session, params.clientId);

  const filtered = skus.filter((sku) => {
    if (scopedClientId && sku.clientId !== scopedClientId) return false;
    const owner = clientsById.get(sku.clientId);
    if (params.wmsLinkId && owner?.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && owner?.country !== params.country) return false;
    if (!withinDateRange(resolveDate(sku, params.dateField), params.dateFrom, params.dateTo)) return false;
    if (!matchesKeyword(params.keyword, sku.skuCode, sku.name, sku.clientName)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getSku(id: string): Promise<Sku | null> {
  await delay();
  const session = await getSession();
  const sku = skus.find((s) => s.id === id) ?? null;
  if (!sku) return null;
  if (session.role === "CLIENT" && sku.clientId !== session.clientId) return null;
  return sku;
}

export async function createSku(input: SkuInput): Promise<Sku> {
  await delay();
  const owner = clientsById.get(input.clientId);
  const now = new Date().toISOString();
  const newSku: Sku = {
    id: `sku-${skus.length + 1}`,
    clientId: input.clientId,
    clientName: owner?.name ?? input.clientId,
    skuCode: input.skuCode,
    name: input.name,
    category: input.category,
    unit: input.unit,
    createdAt: now,
    updatedAt: now,
  };
  skus = [newSku, ...skus];
  return newSku;
}

export async function updateSku(id: string, input: Partial<SkuInput>): Promise<Sku | null> {
  await delay();
  const index = skus.findIndex((s) => s.id === id);
  if (index === -1) return null;
  const updated: Sku = { ...skus[index], ...input, updatedAt: new Date().toISOString() };
  skus = skus.map((s, i) => (i === index ? updated : s));
  return updated;
}
