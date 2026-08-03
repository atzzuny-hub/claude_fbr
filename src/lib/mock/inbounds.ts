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

// RECEIVED 비중이 가장 높고 WAITING/SCHEDULED가 섞이며 CANCELLED(취소)도 일부 나오도록 설계한 9칸 순환表.
// 길이를 홀수로 둔 것은 의도적 설계: clientIndex(= i % 20, 20은 짝수)와 i를 더한
// 값은 항상 짝수가 되므로, 순환 길이가 짝수면 홀수 인덱스(SCHEDULED 등)가 영영
// 선택되지 않는 대칭성 버그가 생긴다. 길이를 2와 서로소인 홀수(9)로 두면
// "짝수만 나오는 값 mod 홀수"가 전체 나머지를 모두 순회하게 되어 이 문제가 사라진다.
const STATUS_CYCLE: InboundStatus[] = [
  "RECEIVED",
  "WAITING",
  "SCHEDULED",
  "RECEIVED",
  "CANCELLED",
  "WAITING",
  "RECEIVED",
  "SCHEDULED",
  "CANCELLED",
];
void INBOUND_STATUS; // 상태값 출처 문서화용 참조

const TOTAL_INBOUNDS = 64;

// 단계별 시각 풀 — 접수는 업무시간, 도착은 이른 아침~저녁 하차, 완료는 그보다 늦은 시간대로
// 서로 다른 길이(홀수/짝수 섞음)를 줘서 행마다 같은 조합이 반복되지 않게 한다.
// 세 단계는 항상 서로 다른 날이므로(도착 = 접수+2~4일, 완료 = 도착+1~2일) 시각끼리의 선후는 무관하다.
const RECEIPT_TIMES = ["09:15:00", "10:40:00", "11:05:00", "13:20:00", "14:50:00"];
const ARRIVAL_TIMES = ["07:30:00", "08:45:00", "10:10:00", "13:05:00", "15:40:00", "18:25:00"];
const COMPLETED_TIMES = ["11:00:00", "12:35:00", "14:15:00", "16:05:00", "17:45:00"];

// 입고 상품 라인용 상품 카탈로그(영문/한글 표기 쌍). 길이 8 — 행마다 1~3개 라인을 여기서 순환 선택.
const LINE_TEMPLATES: { skuCode: string; productName: string; productNameKo: string; unit: string }[] = [
  { skuCode: "BJ-TONER-500", productName: "Glow Toner 500ml", productNameKo: "글로우 토너 500ml", unit: "EA" },
  { skuCode: "BJ-SERUM-050", productName: "Vita Serum 50ml", productNameKo: "비타 세럼 50ml", unit: "EA" },
  { skuCode: "BJ-CREAM-100", productName: "Moisture Cream 100ml", productNameKo: "수분 크림 100ml", unit: "EA" },
  { skuCode: "BJ-CLEANSER-150", productName: "Mild Cleanser 150ml", productNameKo: "약산성 클렌저 150ml", unit: "EA" },
  { skuCode: "BJ-SUN-050", productName: "UV Sun Cream 50ml", productNameKo: "UV 선크림 50ml", unit: "EA" },
  { skuCode: "BJ-MASK-10", productName: "Soothing Mask 10P", productNameKo: "수딩 마스크팩 10매", unit: "SET" },
  { skuCode: "BJ-AMPOULE-030", productName: "Repair Ampoule 30ml", productNameKo: "리페어 앰플 30ml", unit: "EA" },
  { skuCode: "BJ-LOTION-200", productName: "Daily Lotion 200ml", productNameKo: "데일리 로션 200ml", unit: "EA" },
];

// 입고 요청 고객명 풀(길이 12, 순환). 클라이언트(마켓)와 별개의 담당 고객.
const CUSTOMER_NAMES = [
  "김서연", "이준호", "박민지", "최우진", "정하윤", "강도현",
  "윤서아", "임지후", "한예린", "오세훈", "서지우", "문가은",
];

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
  // 상태별 진행 단계: 예정=접수만, 대기=도착까지, 입고=완료까지.
  // 취소(CANCELLED)는 종료 상태 — 접수 후 취소된 것으로 보아 도착/완료일 없이 접수일만 둔다.
  const arrivalDay =
    status === "SCHEDULED" || status === "CANCELLED" ? null : addDays(receiptDay, 2 + (i % 3));
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
  const id = `inb-${pad(i + 1, 4)}`;

  // 상품 라인 1~3개 — 템플릿을 순환 선택하고 수량은 산술로 계산(실행마다 동일).
  const lineCount = 1 + (i % 3);
  const lines = Array.from({ length: lineCount }, (_, j) => {
    const template = LINE_TEMPLATES[(i + j * 3) % LINE_TEMPLATES.length];
    const totalQuantity = (3 + ((i * 2 + j * 5) % 16)) * 100; // 300~1800, 100단위
    // 오류수량은 대부분 미확인(null → "—"), 일부만 소량 발생.
    const errorQuantity = (i + j) % 5 === 0 ? ((i % 3) + 1) * 2 : null;
    // 사용가능수량은 입고 완료(RECEIVED)된 일부 라인에서만 채워지고, 그 외는 0.
    const availableQuantity =
      status === "RECEIVED" && (i + j) % 4 === 0 ? totalQuantity - (errorQuantity ?? 0) : 0;
    return {
      id: `${id}-l${j + 1}`,
      skuCode: template.skuCode,
      productName: template.productName,
      productNameKo: template.productNameKo,
      unit: template.unit,
      totalQuantity,
      availableQuantity,
      errorQuantity,
    };
  });
  // 총 입고수량 = 라인 합. 대표 SKU 코드/명은 첫 라인 상품으로 둔다(목록 검색·CSV 표기용).
  const quantity = lines.reduce((sum, line) => sum + line.totalQuantity, 0);

  const inbound: Inbound = {
    id,
    clientId: client.id,
    clientName: client.name,
    customerName: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
    // 연락처는 인덱스 기반 결정적 생성(+82 10-XXXX-XXXX 형식)
    customerContact: `+82 10-${pad((i * 137 + 2000) % 10000, 4)}-${pad((i * 613 + 93) % 10000, 4)}`,
    skuId: sku.id,
    skuCode: lines[0].skuCode,
    skuName: lines[0].productNameKo,
    country: client.country,
    wmsLinkId: client.wmsLinkId,
    wmsLinkName: client.wmsLinkName,
    status,
    // 번호 형식은 잠정 — 주문번호(클라이언트 발주)와 접수번호(입고 접수 시 발급)를 한눈에
    // 구분할 수 있게 접두어를 다르게 둔다
    orderNo: `PO${compactDate(receiptDay).slice(2)}${pad(i + 1, 3)}`,
    receiptNo: `${receiptPrefix}${compactDate(receiptDay)}${pad(i + 1, 3)}`,
    quantity,
    lines,
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
