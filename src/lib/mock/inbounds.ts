import type { Inbound, InboundStatus } from "@/types";
import { INBOUND_STATUS } from "@/types";
import { mockClients } from "./clients";
import { mockSkus } from "./skus";
import { addDays, compactDate, pad, pickDate, toDatetime } from "./seed-helpers";

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

// 단계별 시각 풀 — 접수는 업무시간, 도착은 이른 아침~저녁 하차, 완료는 그보다 늦은 시간대로
// 서로 다른 길이(홀수/짝수 섞음)를 줘서 행마다 같은 조합이 반복되지 않게 한다.
// 세 단계는 항상 서로 다른 날이므로(도착 = 접수+2~4일, 완료 = 도착+1~2일) 시각끼리의 선후는 무관하다.
const RECEIPT_TIMES = ["09:15:00", "10:40:00", "11:05:00", "13:20:00", "14:50:00"];
const ARRIVAL_TIMES = ["07:30:00", "08:45:00", "10:10:00", "13:05:00", "15:40:00", "18:25:00"];
const COMPLETED_TIMES = ["11:00:00", "12:35:00", "14:15:00", "16:05:00", "17:45:00"];

export const mockInbounds: Inbound[] = Array.from({ length: TOTAL_INBOUNDS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];
  const clientSkus = skusByClient.get(client.id) ?? [];
  const sku = clientSkus[i % clientSkus.length];

  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];

  // 날짜 계산은 순수 날짜(YYYY-MM-DD)로 하고, 필드에 담을 때만 시각을 붙인다 — addDays가
  // 날짜 문자열을 전제로 하므로 중간 계산에 날짜시간을 섞지 않는다.
  // 접수일을 날짜 풀보다 6일 앞으로 당겨 두면, 뒤에 더하는 도착(+2~4일)·완료(+1~2일)까지
  // 모두 풀의 마지막 날짜(=기준일 2026-07-31) 안에 들어와 미래 날짜가 생기지 않는다.
  const receiptDay = addDays(pickDate(i, 0), -6);
  // 상태별 진행 단계: 예정=접수만, 대기=도착까지, 입고=완료까지
  const arrivalDay = status === "SCHEDULED" ? null : addDays(receiptDay, 2 + (i % 3));
  const completedDay =
    status === "RECEIVED" && arrivalDay ? addDays(arrivalDay, 1 + (i % 2)) : null;

  const receiptDate = toDatetime(receiptDay, RECEIPT_TIMES[i % RECEIPT_TIMES.length]);
  const arrivalDate = arrivalDay
    ? toDatetime(arrivalDay, ARRIVAL_TIMES[i % ARRIVAL_TIMES.length])
    : null;
  const completedDate = completedDay
    ? toDatetime(completedDay, COMPLETED_TIMES[i % COMPLETED_TIMES.length])
    : null;
  const receiptPrefix = i % 2 === 0 ? "IRSPG" : "IRADC";

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
    // 번호 형식은 잠정 — 주문번호(클라이언트 발주)와 접수번호(입고 접수 시 발급)를 한눈에
    // 구분할 수 있게 접두어를 다르게 둔다
    orderNo: `PO${compactDate(receiptDay).slice(2)}${pad(i + 1, 3)}`,
    receiptNo: `${receiptPrefix}${compactDate(receiptDay)}${pad(i + 1, 3)}`,
    quantity: 20 + ((i * 13) % 180),
    receiptDate,
    arrivalDate,
    completedDate,
    // 등록은 접수보다 앞선 시각(접수 시각 풀의 최솟값 09:15보다 이르게 고정)
    createdAt: toDatetime(receiptDay, "08:30:00"),
    // 최근 수정 = 마지막으로 일어난 단계의 시각
    updatedAt: completedDate ?? arrivalDate ?? receiptDate,
  };
  return inbound;
});
