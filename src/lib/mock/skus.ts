import type { Sku } from "@/types";
import { mockClients } from "./clients";
import { pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * Sku 목데이터 — Client 다음으로 정의(참조 무결성 순서).
 * 각 클라이언트 소유로 1~2개씩 배정해 36건을 생성한다(고정 카운트표, 런타임 랜덤 없음).
 * 생성 로직은 산술/순환뿐이라 실행마다 동일한 결과를 만든다.
 */

const PRODUCT_TEMPLATES: { category: string; unit: string; names: string[] }[] = [
  { category: "스킨케어", unit: "EA", names: ["수딩 세럼 30ml", "모이스처 크림 50ml", "브라이트닝 토너 150ml", "리페어 앰플 30ml"] },
  { category: "클렌징", unit: "EA", names: ["약산성 클렌저 150ml", "폼클렌징 120ml"] },
  { category: "선케어", unit: "EA", names: ["선크림 50ml", "선스틱 20g"] },
  { category: "마스크팩", unit: "SET", names: ["수딩 마스크팩 10매입"] },
];

// 클라이언트별 SKU 보유 개수 — 앞 16개 클라이언트는 2개, 나머지 4개는 1개 (2*16 + 1*4 = 36)
const SKU_COUNT_PER_CLIENT = mockClients.map((_, i) => (i < 16 ? 2 : 1));

export const mockSkus: Sku[] = mockClients.flatMap((client, clientIndex) => {
  const count = SKU_COUNT_PER_CLIENT[clientIndex];
  return Array.from({ length: count }, (_, j) => {
    const template = PRODUCT_TEMPLATES[(clientIndex + j) % PRODUCT_TEMPLATES.length];
    const nameIndex = (clientIndex * 2 + j) % template.names.length;
    const seedIndex = clientIndex * 2 + j;
    const createdDate = pickDate(seedIndex, 0);
    const updatedDate = pickDate(seedIndex, 3);

    const sku: Sku = {
      id: `sku-${pad(seedIndex + 1, 3)}`,
      clientId: client.id,
      clientName: client.name,
      skuCode: `SKU-${pad(clientIndex + 1, 2)}-${pad(j + 1, 2)}`,
      name: `${client.name} ${template.names[nameIndex]}`,
      category: template.category,
      unit: template.unit,
      createdAt: toDatetime(createdDate, "09:00:00"),
      updatedAt: toDatetime(updatedDate, "10:00:00"),
    };
    return sku;
  });
});
