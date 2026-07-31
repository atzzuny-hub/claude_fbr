import type { Outbound, OutboundStatus } from "@/types";
import { mockClients } from "./clients";
import { mockSkus } from "./skus";
import { compactDate, pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * Outbound 목데이터 — Client/Sku 다음으로 정의(참조 무결성 순서). 34건.
 */

const skusByClient = new Map<string, typeof mockSkus>();
for (const sku of mockSkus) {
  const list = skusByClient.get(sku.clientId) ?? [];
  list.push(sku);
  skusByClient.set(sku.clientId, list);
}

// 길이를 홀수(7)로 두는 이유는 inbounds.ts 상단 주석 참고
// (clientIndex와 i의 합이 항상 짝수가 되는 대칭성 문제를 피하기 위함).
const STATUS_CYCLE: OutboundStatus[] = [
  "SHIPPED",
  "SHIPPED",
  "PREPARING",
  "SCHEDULED",
  "SHIPPED",
  "PREPARING",
  "SCHEDULED",
];

const TOTAL_OUTBOUNDS = 34;

export const mockOutbounds: Outbound[] = Array.from({ length: TOTAL_OUTBOUNDS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];
  const clientSkus = skusByClient.get(client.id) ?? [];
  const sku = clientSkus[i % clientSkus.length];

  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];
  const orderDate = pickDate(i, 1);
  const shippedDate = status === "SHIPPED" ? orderDate : null;

  const outbound: Outbound = {
    id: `outb-${pad(i + 1, 4)}`,
    clientId: client.id,
    clientName: client.name,
    skuId: sku.id,
    skuCode: sku.skuCode,
    skuName: sku.name,
    country: client.country,
    wmsLinkId: client.wmsLinkId,
    wmsLinkName: client.wmsLinkName,
    status,
    referenceNo: `AN${compactDate(orderDate)}${pad(i + 1, 3)}`,
    quantity: 15 + ((i * 9) % 150),
    orderDate,
    shippedDate,
    createdAt: toDatetime(orderDate, "09:15:00"),
    updatedAt: toDatetime(shippedDate ?? orderDate, "18:00:00"),
  };
  return outbound;
});
