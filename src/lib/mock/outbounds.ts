import type { Outbound, OutboundDelivery, OutboundProduct, OutboundStatus } from "@/types";
import { mockClients } from "./clients";
import { mockWmsLinks } from "./wms-links";
import { addDays, compactDate, pad, pickDate, toEpoch } from "./seed-helpers";

/**
 * Outbound 목데이터 — 출고 목록 API 응답 스키마(GET /dtob DataOutboundRes, Swagger 확정
 * 2026-08-06)를 그대로 따른다. 48건, 20개 클라이언트를 순환. 날짜류는 전부 UTC epoch
 * 밀리초(toEpoch — 도메인 모델 단위. 와이어 초 단위 되돌림은 lib/data 몫).
 * 상태는 출고(COMPLETED) 비중을 높게 두고 취소·반품·부분반품·UNKNOW(매핑 실패)도 소수 포함,
 * 출고된 행에만 배송상태·운송장·배송지 진행을 채워 두 상태 축의 조합을 화면에서 확인할 수
 * 있게 한다.
 */

// 길이를 홀수(11)로 두는 이유는 inbounds.ts 상단 주석 참고
// (clientIndex와 i의 합이 항상 짝수가 되는 대칭성 문제를 피하기 위함).
const STATUS_CYCLE: OutboundStatus[] = [
  "COMPLETED",
  "PEND",
  "COMPLETED",
  "PICK",
  "COMPLETED",
  "PACK",
  "CANCELED",
  "COMPLETED",
  "RETURNED",
  "P_RETURNED",
  "UNKNOW",
];

// 출고된 행의 배송상태 순환(길이 5 — 홀수). 배송중~완료를 골고루 섞는다.
const DELIVERY_CYCLE: OutboundDelivery[] = ["DELIVERING", "DELIVERED", "COMPLETED", "DELIVERING", "DELIVERED"];

const TOTAL_OUTBOUNDS = 48;

// 단계별 시각 풀 — 주문은 하루 전반, 출고 처리는 업무시간, 배송 이벤트는 오후~저녁대.
const ORDER_TIMES = ["01:12:00", "08:37:00", "11:24:00", "14:03:00", "19:48:00", "22:15:00"];
const RELEASE_TIMES = ["09:20:00", "10:55:00", "13:40:00", "16:05:00", "17:30:00"];
const DELIVERY_TIMES = ["12:10:00", "15:35:00", "18:50:00", "20:25:00"];

// 제품 목록용 카탈로그(sku/barcode/name — Swagger Product). 길이 8, 행마다 1~3줄 순환 선택.
const PROD_TEMPLATES: OutboundProduct[] = [
  { sku: "BJ-TONER-500", barcode: "8809115025001", name: "Glow Toner 500ml" },
  { sku: "BJ-SERUM-050", barcode: "8809115025018", name: "Vita Serum 50ml" },
  { sku: "BJ-CREAM-100", barcode: "8809115025025", name: "Moisture Cream 100ml" },
  { sku: "BJ-CLEANSER-150", barcode: "8809115025032", name: "Mild Cleanser 150ml" },
  { sku: "BJ-SUN-050", barcode: "8809115025049", name: "UV Sun Cream 50ml" },
  { sku: "BJ-MASK-10", barcode: "8809115025056", name: "Soothing Mask 10P" },
  { sku: "BJ-AMPOULE-030", barcode: "8809115025063", name: "Repair Ampoule 30ml" },
  { sku: "BJ-LOTION-200", barcode: "8809115025070", name: "Daily Lotion 200ml" },
];

// 주문 마켓·배송방식(택배사) 풀 — 동남아 커머스 현실 반영.
const MARKETS = ["Shopee", "Lazada", "TikTok Shop"];
const TRANSPORTERS = ["J&T Express", "Ninja Van", "GHN", "Flash Express"];

// 국가별 수취인 이름·주소 풀 — 클라이언트(마켓)의 국가에 맞춰 선택한다.
const RECEIVERS: Record<string, { names: string[]; addrs: string[]; zip: string; telPrefix: string }> = {
  VN: {
    names: ["Nguyen Thi Lan", "Tran Van Minh", "Le Thi Huong", "Pham Quoc Bao"],
    addrs: ["12 Nguyen Hue, Q.1, TP.HCM", "88 Tran Hung Dao, Hoan Kiem, Ha Noi", "45 Le Loi, Da Nang"],
    zip: "700000",
    telPrefix: "+84 9",
  },
  PH: {
    names: ["Maria Santos", "Jose Reyes", "Angel Dela Cruz", "Grace Bautista"],
    addrs: ["Unit 5B, Ayala Ave, Makati", "23 Rizal St, Quezon City", "Lot 7, Cebu Business Park, Cebu"],
    zip: "1226",
    telPrefix: "+63 9",
  },
  MY: {
    names: ["Ahmad Faizal", "Siti Nurhaliza", "Lim Wei Jie", "Nurul Aina"],
    addrs: ["12 Jalan Bukit Bintang, KL", "8 Lorong Penang 3, Georgetown", "31 Jalan Austin, Johor Bahru"],
    zip: "55100",
    telPrefix: "+60 1",
  },
};

// 접수번호(ganNo)는 마켓주문번호 — 마켓 접두어를 순환해 마켓별 번호처럼 보이게 한다.
const GAN_PREFIXES = ["SPE", "LZD", "TIK"];

// 상태별 WMS 원본 코드 샘플 — statusOriginalCode는 대부분 null이고 일부 행에만 원문이 남는다.
const ORIGINAL_CODES: Partial<Record<OutboundStatus, string>> = {
  PEND: "NEW",
  PICK: "PICKING",
  PACK: "PACKING",
  COMPLETED: "SHIP",
  CANCELED: "CXL",
  RETURNED: "RTN",
  P_RETURNED: "RTN_P",
};

export const mockOutbounds: Outbound[] = Array.from({ length: TOTAL_OUTBOUNDS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];
  // 응답의 wmsId/wmsLinkId는 수치 ID — 소속 WMS LINK의 idx에서 가져온다(입고와 동일 규칙).
  const wmsLink = mockWmsLinks.find((link) => link.id === client.wmsLinkId);
  if (!wmsLink) throw new Error(`unknown wmsLinkId: ${client.wmsLinkId}`);

  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];
  // 출고 이후에만 배송 축이 생긴다 — 반품 계열은 배송 결과가 반품으로 끝난 케이스.
  const shipped = status === "COMPLETED" || status === "RETURNED" || status === "P_RETURNED";

  // 날짜 계산은 순수 날짜(YYYY-MM-DD)로 하고, 필드에 담을 때만 epoch(ms)로 바꾼다.
  // 주문일을 5일 앞으로 당겨 출고(+1~2일)·배송 이벤트(+2~4일)까지 풀의 기준일 안에 들어온다.
  const orderDay = addDays(pickDate(i, 2), -5);
  const releaseDay = addDays(orderDay, 1 + (i % 2)); // 출고상태 변경일 — 모든 행에 존재(취소 포함)
  const deliveryDay = shipped ? addDays(releaseDay, 2 + (i % 3)) : null;

  const orderDt = toEpoch(orderDay, ORDER_TIMES[i % ORDER_TIMES.length]);
  const releaseDt = toEpoch(releaseDay, RELEASE_TIMES[i % RELEASE_TIMES.length]);
  const deliveryDt = deliveryDay ? toEpoch(deliveryDay, DELIVERY_TIMES[i % DELIVERY_TIMES.length]) : null;

  // 배송상태 — 반품 계열은 RETURNED로 끝나고, 출고 직후 일부 행(1/7)은 아직 배송 축이 없다.
  const delivery: OutboundDelivery | null = !shipped
    ? null
    : status === "RETURNED" || status === "P_RETURNED"
      ? "RETURNED"
      : i % 7 === 0
        ? null
        : DELIVERY_CYCLE[(i + clientIndex) % DELIVERY_CYCLE.length];

  const idx = i + 1;

  // 제품 목록 1~3줄 — 템플릿을 순환 선택(실행마다 동일).
  const prodCount = 1 + (i % 3);
  const prodList: OutboundProduct[] = Array.from(
    { length: prodCount },
    (_, j) => PROD_TEMPLATES[(i + j * 3) % PROD_TEMPLATES.length],
  );

  // 금액(double) — 마켓 통화 단위(응답에 통화 필드 없음). 프로모션은 1/4 행에만,
  // COD는 1/3 행(동남아 COD 비중 반영). 취소 행도 주문 시점 금액은 남는다.
  const totalAmount = 25 + ((i * 37) % 400);
  const promotionAmount = i % 4 === 0 ? Math.round(totalAmount * 10) / 100 : 0;
  const actualAmount = totalAmount - promotionAmount;
  const isCod = i % 3 === 0;
  const totalCodAmount = isCod ? actualAmount : 0;
  // 부분반품이면 COD 회수액이 줄어든 케이스를 재현한다.
  const finalCodAmount = isCod ? (status === "P_RETURNED" ? Math.round(actualAmount * 60) / 100 : actualAmount) : 0;

  // 접수번호(마켓주문번호)는 nullable — 일부 행을 비워 "—" 표기를 확인할 수 있게 한다.
  const ganNo =
    i % 16 === 7
      ? null
      : `${GAN_PREFIXES[i % GAN_PREFIXES.length]}${compactDate(orderDay).slice(2)}${pad(idx, 4)}`;

  // 수취인 — 클라이언트 국가 풀에서 선택. 일부 행(1/13)은 배송지 정보 자체가 없다(nullable).
  const receiverPool = RECEIVERS[client.country] ?? RECEIVERS.VN;
  const receiver =
    i % 13 === 5
      ? null
      : {
          country: client.country,
          name: receiverPool.names[i % receiverPool.names.length],
          addr: receiverPool.addrs[i % receiverPool.addrs.length],
          // 청구 주소는 대부분 배송 주소와 동일(값 없음 null) — 일부 행에만 별도 존재.
          billAddr: i % 6 === 2 ? receiverPool.addrs[(i + 1) % receiverPool.addrs.length] : null,
          zipCode: receiverPool.zip,
          tel: null, // 일반 전화는 거의 없음 — 휴대전화만 채운다
          mobile: `${receiverPool.telPrefix}${pad((i * 271 + 1234) % 100000000, 8)}`,
        };

  // 마지막으로 일어난 이벤트 시각 — WMS/FBR 변경일 계산에 쓴다.
  const lastEventDt = deliveryDt ?? releaseDt;

  const outbound: Outbound = {
    idx,
    wmsId: wmsLink.idx, // WMS와 WMS LINK의 수치 ID 관계는 잠정 동일 번호(WMS Swagger 확정 전)
    wmsLinkId: wmsLink.idx,
    wmsLinkName: client.wmsLinkName,
    clntName: client.name,
    ganNo,
    cntyCd: client.country,
    marketName: MARKETS[(i + clientIndex) % MARKETS.length],
    orderDt,
    // 원본 코드는 일부 행에만 남기고, UNKNOW 행은 매핑 실패 원문을 그대로 노출한다.
    statusOriginalCode:
      status === "UNKNOW" ? `X-${pad((i * 7) % 100, 2)}` : i % 4 === 0 ? (ORIGINAL_CODES[status] ?? null) : null,
    status,
    deliveryOriginalCode: delivery !== null && i % 5 === 0 ? `D-${pad((i * 3) % 100, 2)}` : null,
    delivery,
    releaseDt,
    deliveryDt,
    prodList,
    // 배송방식·운송장은 출고된 행에만 생긴다.
    transporter: shipped ? TRANSPORTERS[(i + clientIndex) % TRANSPORTERS.length] : null,
    trackingNo: shipped ? `${client.country}${pad((i * 9173 + 500000) % 1000000, 6)}${pad(idx, 4)}` : null,
    receiver,
    dataId: `WMS${pad(wmsLink.idx, 2)}-OB-${pad(idx, 5)}`,
    totalAmount,
    promotionAmount,
    actualAmount,
    totalCodAmount,
    finalCodAmount,
    // B2B 출고(대량)는 소수 — 나머지는 마켓 B2C 주문.
    businessType: i % 12 === 9 ? "B2B" : "B2C",
    // WMS 쪽 생성/변경 → FBR 수집(등록)이 뒤따르는 시간 순서로 배치한다(입고와 동일).
    dataRegDt: toEpoch(orderDay, "23:50:00"),
    dataUpdDt: lastEventDt,
    regDt: toEpoch(addDays(orderDay, 1), "00:10:00"),
    updDt: lastEventDt,
  };
  return outbound;
});
