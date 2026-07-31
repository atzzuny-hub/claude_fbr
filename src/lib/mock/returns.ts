import type { Return, ReturnStatus } from "@/types";
import { mockClients } from "./clients";
import { mockSkus } from "./skus";
import { compactDate, pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * Return(반품) 목데이터 — Client/Sku 다음으로 정의(참조 무결성 순서). 32건.
 */

const skusByClient = new Map<string, typeof mockSkus>();
for (const sku of mockSkus) {
  const list = skusByClient.get(sku.clientId) ?? [];
  list.push(sku);
  skusByClient.set(sku.clientId, list);
}

// 길이를 홀수(7)로 두는 이유는 lib/mock/inbounds.ts 상단 주석 참고.
const STATUS_CYCLE: ReturnStatus[] = [
  "COMPLETED",
  "COMPLETED",
  "INSPECTING",
  "REQUESTED",
  "COMPLETED",
  "INSPECTING",
  "REQUESTED",
];

const REASONS = ["단순 변심", "상품 불량", "오배송", "사이즈/옵션 불일치", "배송 지연으로 인한 취소"];

const TOTAL_RETURNS = 32;

export const mockReturns: Return[] = Array.from({ length: TOTAL_RETURNS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];
  const clientSkus = skusByClient.get(client.id) ?? [];
  const sku = clientSkus[i % clientSkus.length];

  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];
  const requestedDate = pickDate(i, 2);
  const completedDate = status === "COMPLETED" ? requestedDate : null;

  const ret: Return = {
    id: `ret-${pad(i + 1, 4)}`,
    clientId: client.id,
    clientName: client.name,
    skuId: sku.id,
    skuCode: sku.skuCode,
    skuName: sku.name,
    country: client.country,
    wmsLinkId: client.wmsLinkId,
    wmsLinkName: client.wmsLinkName,
    status,
    referenceNo: `RT${compactDate(requestedDate)}${pad(i + 1, 3)}`,
    quantity: 1 + (i % 10),
    reason: REASONS[i % REASONS.length],
    requestedDate,
    completedDate,
    createdAt: toDatetime(requestedDate, "10:00:00"),
    updatedAt: toDatetime(completedDate ?? requestedDate, "16:30:00"),
  };
  return ret;
});
