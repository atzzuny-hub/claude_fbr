import type { InventoryItem } from "@/types";
import { mockClients } from "./clients";
import { mockSkus } from "./skus";
import { pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * InventoryItem 목데이터 — Client/Sku 다음으로 정의(참조 무결성 순서).
 * SKU 1건당 재고 1행으로 생성(36건) — 클라이언트별·SKU별 재고 조회 화면과 자연스럽게 대응.
 */

const clientsById = new Map(mockClients.map((c) => [c.id, c]));

export const mockInventoryItems: InventoryItem[] = mockSkus.map((sku, i) => {
  const client = clientsById.get(sku.clientId);
  if (!client) throw new Error(`unknown clientId: ${sku.clientId}`);

  const quantity = 50 + ((i * 17) % 450);
  const allocatedQuantity = Math.min(quantity, 10 + ((i * 5) % 80));
  const availableQuantity = quantity - allocatedQuantity;
  const updatedDate = pickDate(i, 5);

  const item: InventoryItem = {
    id: `inv-${pad(i + 1, 4)}`,
    clientId: client.id,
    clientName: client.name,
    skuId: sku.id,
    skuCode: sku.skuCode,
    skuName: sku.name,
    country: client.country,
    wmsLinkId: client.wmsLinkId,
    wmsLinkName: client.wmsLinkName,
    quantity,
    availableQuantity,
    allocatedQuantity,
    updatedAt: toDatetime(updatedDate, "07:00:00"),
  };
  return item;
});
