import type { Inbound, InboundStatus } from "@/types";
import { INBOUND_STATUS } from "@/types";
import { mockClients } from "./clients";
import { mockSkus } from "./skus";
import { compactDate, pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * Inbound 목데이터 — Client/Sku 다음으로 정의(참조 무결성 순서).
 * 64건, 20개 클라이언트를 순환하며 각 클라이언트 소유 SKU만 참조한다.
 * 상태는 (인덱스+클라이언트인덱스) 기반 8단계 순환으로 예정/대기/입고를 골고루 섞어
 * 클라이언트별로도 서로 다른 상태 조합이 나오게 한다.
 */

const skusByClient = new Map<string, typeof mockSkus>();
for (const sku of mockSkus) {
  const list = skusByClient.get(sku.clientId) ?? [];
  list.push(sku);
  skusByClient.set(sku.clientId, list);
}

// RECEIVED 비중이 가장 높고 WAITING/SCHEDULED가 섞이도록 설계한 7칸 순환表.
// 길이를 홀수로 둔 것은 의도적 설계: clientIndex(= i % 20, 20은 짝수)와 i를 더한
// 값은 항상 짝수가 되므로, 순환 길이가 짝수면 홀수 인덱스(SCHEDULED 등)가 영영
// 선택되지 않는 대칭성 버그가 생긴다. 길이를 2와 서로소인 홀수(7)로 두면
// "짝수만 나오는 값 mod 홀수"가 전체 나머지를 모두 순회하게 되어 이 문제가 사라진다.
const STATUS_CYCLE: InboundStatus[] = [
  "RECEIVED",
  "RECEIVED",
  "WAITING",
  "SCHEDULED",
  "RECEIVED",
  "WAITING",
  "SCHEDULED",
];
void INBOUND_STATUS; // 상태값 출처 문서화용 참조

const TOTAL_INBOUNDS = 64;

export const mockInbounds: Inbound[] = Array.from({ length: TOTAL_INBOUNDS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];
  const clientSkus = skusByClient.get(client.id) ?? [];
  const sku = clientSkus[i % clientSkus.length];

  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];
  const expectedDate = pickDate(i, 0);
  const receivedDate = status === "RECEIVED" ? expectedDate : null;
  const prefix = i % 2 === 0 ? "IRSPG" : "IRADC";

  const inbound: Inbound = {
    id: `inb-${pad(i + 1, 4)}`,
    clientId: client.id,
    clientName: client.name,
    skuId: sku.id,
    skuCode: sku.skuCode,
    skuName: sku.name,
    country: client.country,
    wmsLinkId: client.wmsLinkId,
    wmsLinkName: client.wmsLinkName,
    status,
    referenceNo: `${prefix}${compactDate(expectedDate)}${pad(i + 1, 3)}`,
    quantity: 20 + ((i * 13) % 180),
    expectedDate,
    receivedDate,
    createdAt: toDatetime(expectedDate, "08:30:00"),
    updatedAt: toDatetime(receivedDate ?? expectedDate, "17:00:00"),
  };
  return inbound;
});
