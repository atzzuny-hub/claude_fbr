import type { Inbound, InboundSku, InboundStatus } from "@/types";
import { mockClients } from "./clients";
import { mockWmsLinks } from "./wms-links";
import { addDays, compactDate, pad, pickDate, toEpoch } from "./seed-helpers";

/**
 * Inbound 목데이터 — 입고 목록 API 응답 스키마(Swagger 확정)를 그대로 따른다.
 * 64건, 20개 클라이언트를 순환. 날짜류는 전부 UTC epoch 밀리초(toEpoch).
 * 상태는 (인덱스+클라이언트인덱스) 기반 9칸 순환으로 예정/대기/입고/취소를 골고루 섞고,
 * 원본 코드 매핑 실패 케이스(UNKNOW)도 소수 포함해 화면의 예외 표현을 확인할 수 있게 한다.
 */

// COMPLETED 비중이 가장 높고 STANDBY/PLAN이 섞이며 CANCELED(취소)·UNKNOW(매핑 실패)도 일부.
// 길이를 홀수로 둔 것은 의도적 설계: clientIndex(= i % 20, 20은 짝수)와 i를 더한
// 값은 항상 짝수가 되므로, 순환 길이가 짝수면 홀수 인덱스가 영영 선택되지 않는
// 대칭성 버그가 생긴다. 길이를 2와 서로소인 홀수(9)로 두면 전체 나머지를 모두 순회한다.
const STATUS_CYCLE: InboundStatus[] = [
  "COMPLETED",
  "STANDBY",
  "PLAN",
  "COMPLETED",
  "CANCELED",
  "STANDBY",
  "COMPLETED",
  "PLAN",
  "UNKNOW",
];

const TOTAL_INBOUNDS = 64;

// 단계별 시각 풀 — 접수는 업무시간, 도착은 이른 아침~저녁 하차 시간대로
// 서로 다른 길이(홀수/짝수 섞음)를 줘서 행마다 같은 조합이 반복되지 않게 한다.
const REQ_TIMES = ["09:15:00", "10:40:00", "11:05:00", "13:20:00", "14:50:00"];
const ARV_TIMES = ["07:30:00", "08:45:00", "10:10:00", "13:05:00", "15:40:00", "18:25:00"];

// 제품 목록(SKU LIST)용 카탈로그. 길이 8 — 행마다 1~3개 라인을 여기서 순환 선택.
// 단위는 Swagger 예시(Pcs)를 기본으로 하고 세트 상품만 Set.
const PROD_TEMPLATES: { sku: string; productName: string; unit: string }[] = [
  { sku: "BJ-TONER-500", productName: "Glow Toner 500ml", unit: "Pcs" },
  { sku: "BJ-SERUM-050", productName: "Vita Serum 50ml", unit: "Pcs" },
  { sku: "BJ-CREAM-100", productName: "Moisture Cream 100ml", unit: "Pcs" },
  { sku: "BJ-CLEANSER-150", productName: "Mild Cleanser 150ml", unit: "Pcs" },
  { sku: "BJ-SUN-050", productName: "UV Sun Cream 50ml", unit: "Pcs" },
  { sku: "BJ-MASK-10", productName: "Soothing Mask 10P", unit: "Set" },
  { sku: "BJ-AMPOULE-030", productName: "Repair Ampoule 30ml", unit: "Pcs" },
  { sku: "BJ-LOTION-200", productName: "Daily Lotion 200ml", unit: "Pcs" },
];

// 입고 요청 고객명 풀(길이 12, 순환). 클라이언트(마켓)와 별개의 담당 고객.
const CONTACT_NAMES = [
  "김서연", "이준호", "박민지", "최우진", "정하윤", "강도현",
  "윤서아", "임지후", "한예린", "오세훈", "서지우", "문가은",
];

// 접수번호(ganNo)는 마켓주문번호 — 동남아 마켓 접두어를 순환해 마켓별 번호처럼 보이게 한다.
const GAN_PREFIXES = ["SPE", "LZD", "TIK"];

// 상태별 WMS 원본 코드 샘플 — statusOriginalCode는 대부분 null이고 일부 행에만 원문이 남는다.
const ORIGINAL_CODES: Partial<Record<InboundStatus, string>> = {
  PLAN: "INIT",
  STANDBY: "IDLE",
  COMPLETED: "DONE",
  CANCELED: "CXL",
};

export const mockInbounds: Inbound[] = Array.from({ length: TOTAL_INBOUNDS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];
  // 응답의 wmsId/wmsLinkId는 수치 ID — 소속 WMS LINK의 idx에서 가져온다.
  const wmsLink = mockWmsLinks.find((link) => link.id === client.wmsLinkId);
  if (!wmsLink) throw new Error(`unknown wmsLinkId: ${client.wmsLinkId}`);

  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];

  // 날짜 계산은 순수 날짜(YYYY-MM-DD)로 하고, 필드에 담을 때만 epoch(ms)로 바꾼다.
  // 접수일을 날짜 풀보다 6일 앞으로 당겨 두면 뒤에 더하는 도착예정(+3~5일)·
  // 도착(예정±1일)까지 모두 풀의 마지막 날짜(기준일 2026-07-31) 안에 들어온다.
  const reqDay = addDays(pickDate(i, 0), -6);
  // 상태별 진행 단계 — 예정: 접수(+도착예정)만, 대기: 도착까지, 입고: 대기와 동일
  // (완료 시점 필드는 응답에 없다), 취소: 접수만, UNKNOW: 원본 코드 미매핑(접수만).
  const etaDay = status === "CANCELED" || status === "UNKNOW" ? null : addDays(reqDay, 3 + (i % 3));
  const arvDay =
    (status === "STANDBY" || status === "COMPLETED") && etaDay ? addDays(etaDay, i % 2) : null;

  const reqDt = toEpoch(reqDay, REQ_TIMES[i % REQ_TIMES.length]);
  const etaDt = etaDay ? toEpoch(etaDay, "00:00:00") : null; // 도착"예정"일은 시각 없이 자정 기준
  const arvDt = arvDay ? toEpoch(arvDay, ARV_TIMES[i % ARV_TIMES.length]) : null;

  const idx = i + 1;

  // 제품 목록 1~3줄 — 템플릿을 순환 선택하고 수량은 산술로 계산(실행마다 동일).
  const prodCount = 1 + (i % 3);
  const prodList: InboundSku[] = Array.from({ length: prodCount }, (_, j) => {
    const template = PROD_TEMPLATES[(i + j * 3) % PROD_TEMPLATES.length];
    const expQty = (3 + ((i * 2 + j * 5) % 16)) * 100; // 300~1800, 100단위
    // 오류 수량은 대부분 0이고 일부 라인에만 소량 발생.
    const excQty = (i + j) % 5 === 0 ? ((i % 3) + 1) * 2 : 0;
    // 사용 가능 수량은 검수가 끝난 입고 완료(COMPLETED) 라인에서만 확정, 그 외 0.
    const qty = status === "COMPLETED" ? expQty - excQty : 0;
    return { sku: template.sku, productName: template.productName, expQty, qty, excQty, unit: template.unit };
  });
  const prodQty = prodList.reduce((sum, prod) => sum + prod.expQty, 0);

  // 접수번호(마켓주문번호)는 nullable — 일부 행을 비워 "—" 표기를 확인할 수 있게 한다.
  const ganNo =
    i % 16 === 7
      ? null
      : `${GAN_PREFIXES[i % GAN_PREFIXES.length]}${compactDate(reqDay).slice(2)}${pad(idx, 4)}`;

  // 마지막으로 일어난 단계(창고 도착)의 시각 — WMS/FBR 변경일 계산에 쓴다.
  const lastEventDt = arvDt;

  const inbound: Inbound = {
    idx,
    wmsId: wmsLink.idx, // WMS와 WMS LINK의 수치 ID 관계는 잠정 동일 번호(WMS Swagger 확정 전)
    wmsLinkId: wmsLink.idx,
    wmsLinkName: client.wmsLinkName,
    // 원본 코드는 일부 행에만 남기고, UNKNOW 행은 매핑 실패 원문을 그대로 노출한다.
    statusOriginalCode:
      status === "UNKNOW" ? `X-${pad((i * 7) % 100, 2)}` : i % 4 === 0 ? (ORIGINAL_CODES[status] ?? null) : null,
    status,
    ganNo,
    clntName: client.name,
    cntyCd: client.country,
    reqDt,
    etaDt,
    arvDt,
    prodList,
    prodQty,
    // 고객명/연락처는 nullable — 일부 행을 비워 상세의 "—" 표기를 확인한다.
    contactName: i % 13 === 5 ? null : CONTACT_NAMES[i % CONTACT_NAMES.length],
    contactTel:
      i % 11 === 7 ? null : `+82 10-${pad((i * 137 + 2000) % 10000, 4)}-${pad((i * 613 + 93) % 10000, 4)}`,
    dataId: `WMS${pad(wmsLink.idx, 2)}-IN-${pad(idx, 5)}`,
    // WMS 쪽 생성/변경 → FBR 수집(등록)이 뒤따르는 시간 순서로 배치한다.
    dataRegDt: toEpoch(reqDay, "08:30:00"),
    dataUpdDt: lastEventDt,
    regDt: toEpoch(reqDay, "08:45:00"),
    updDt: lastEventDt,
  };
  return inbound;
});
