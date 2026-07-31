import type { WmsRequest, WmsRequestStatus, WmsRequestType } from "@/types";
import { WMS_REQUEST_TYPE } from "@/types";
import { mockClients } from "./clients";
import { mockInbounds } from "./inbounds";
import { pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * WmsRequest(NEW 요청) 목데이터 — Client 다음, Inbound 이후에 정의.
 * PRODUCT_REGISTRATION 유형이면서 REGISTERED 상태인 요청은, PRD 사용자 여정(3→4단계)의
 * "등록 완료 후 입고현황에 예정으로 반영" 흐름을 보여주기 위해 같은 클라이언트의
 * SCHEDULED(예정) 입고 건을 relatedInboundId로 연결한다(클라이언트별 1회씩 소진).
 */

// 클라이언트별 SCHEDULED 입고 id 큐 — 매칭되는 REGISTERED 요청에 1건씩 연결
const scheduledInboundQueueByClient = new Map<string, string[]>();
for (const inbound of mockInbounds) {
  if (inbound.status !== "SCHEDULED") continue;
  const queue = scheduledInboundQueueByClient.get(inbound.clientId) ?? [];
  queue.push(inbound.id);
  scheduledInboundQueueByClient.set(inbound.clientId, queue);
}

// 길이를 홀수(7)로 두는 이유는 lib/mock/inbounds.ts 상단 주석 참고.
const STATUS_CYCLE: WmsRequestStatus[] = [
  "REGISTERED",
  "REGISTERED",
  "PENDING_WMS",
  "SUBMITTED",
  "REGISTERED",
  "PENDING_WMS",
  "SUBMITTED",
];

const LABEL_MEMOS = ["라벨 사이즈 요청: 40x60mm", "바코드 재발행 요청", "다국어 라벨(영/현지어) 요청"];

const TOTAL_REQUESTS = 34;

export const mockWmsRequests: WmsRequest[] = Array.from({ length: TOTAL_REQUESTS }, (_, i) => {
  const clientIndex = i % mockClients.length;
  const client = mockClients[clientIndex];

  const type: WmsRequestType = WMS_REQUEST_TYPE[(i + clientIndex) % WMS_REQUEST_TYPE.length];
  const status = STATUS_CYCLE[(i + clientIndex) % STATUS_CYCLE.length];

  const submittedDate = pickDate(i, 6);
  const submittedAt = toDatetime(submittedDate, "11:00:00");
  const registeredAt = status === "REGISTERED" ? toDatetime(pickDate(i, 7), "15:00:00") : null;
  const updatedAt = registeredAt ?? (status === "PENDING_WMS" ? toDatetime(submittedDate, "14:00:00") : submittedAt);

  let relatedInboundId: string | null = null;
  if (type === "PRODUCT_REGISTRATION" && status === "REGISTERED") {
    const queue = scheduledInboundQueueByClient.get(client.id);
    if (queue && queue.length > 0) {
      relatedInboundId = queue.shift() ?? null;
    }
  }

  const request: WmsRequest = {
    id: `req-${pad(i + 1, 4)}`,
    clientId: client.id,
    clientName: client.name,
    type,
    status,
    country: client.country,
    wmsLinkId: client.wmsLinkId,
    wmsLinkName: client.wmsLinkName,
    referenceNo: `NR${submittedDate.replaceAll("-", "")}${pad(i + 1, 3)}`,
    itemCount: 1 + (i % 15),
    attachmentUrl: i % 3 === 0 ? `/uploads/new-requests/req-${pad(i + 1, 4)}.xlsx` : null,
    memo: type === "LABEL_CREATION" ? LABEL_MEMOS[i % LABEL_MEMOS.length] : null,
    relatedInboundId,
    submittedAt,
    registeredAt,
    createdAt: submittedAt,
    updatedAt,
  };
  return request;
});
