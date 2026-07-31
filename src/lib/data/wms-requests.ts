import type { Paginated, WmsRequest, WmsRequestInput, WmsRequestSearchParams } from "@/types";
import { mockClients } from "@/lib/mock/clients";
import { mockWmsRequests } from "@/lib/mock/wms-requests";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, withinDateRange } from "./utils";

/**
 * WmsRequest (NEW) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F006/F012/F013).
 * 제출은 클라이언트, 운영자는 전체 조회.
 * dateField 허용값: "createdAt" | "submittedAt"(기본) | "registeredAt".
 */
let wmsRequests: WmsRequest[] = [...mockWmsRequests];

const clientsById = new Map(mockClients.map((client) => [client.id, client]));

function resolveDate(row: WmsRequest, dateField?: string): string | null {
  switch (dateField) {
    case "createdAt":
      return row.createdAt;
    case "registeredAt":
      return row.registeredAt;
    case "submittedAt":
    default:
      return row.submittedAt;
  }
}

export async function getWmsRequests(
  params: WmsRequestSearchParams = {},
): Promise<Paginated<WmsRequest>> {
  await delay();
  const session = await getSession();
  const scopedClientId = resolveClientScope(session, params.clientId);

  const filtered = wmsRequests.filter((row) => {
    if (scopedClientId && row.clientId !== scopedClientId) return false;
    if (params.wmsLinkId && row.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && row.country !== params.country) return false;
    if (params.status && row.status !== params.status) return false;
    if (params.type && row.type !== params.type) return false;
    if (!withinDateRange(resolveDate(row, params.dateField), params.dateFrom, params.dateTo)) return false;
    if (!matchesKeyword(params.keyword, row.referenceNo, row.clientName)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getWmsRequest(id: string): Promise<WmsRequest | null> {
  await delay();
  const session = await getSession();
  const row = wmsRequests.find((r) => r.id === id) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT" && row.clientId !== session.clientId) return null;
  return row;
}

/**
 * NEW 요청 제출(F006) — 직접 입력/엑셀 업로드 공통 진입점.
 * 제출 즉시 상태는 SUBMITTED. WMS 등록 대기 → 등록 완료 전환은 이메일 기반
 * 휴먼 인 더 루프(PRD ②)로 이 함수의 책임 밖이다 — Phase 2에서 실제 동기화 API로 반영.
 * CLIENT 역할이 제출하면 세션의 clientId로 강제(요청 바디의 clientId 무시).
 */
export async function createWmsRequest(input: WmsRequestInput): Promise<WmsRequest> {
  await delay();
  const session = await getSession();
  const clientId = session.role === "CLIENT" ? session.clientId ?? input.clientId : input.clientId;
  const owner = clientsById.get(clientId);
  const now = new Date().toISOString();
  const seq = wmsRequests.length + 1;

  const newRequest: WmsRequest = {
    id: `req-${seq}`,
    clientId,
    clientName: owner?.name ?? clientId,
    type: input.type,
    status: "SUBMITTED",
    country: owner?.country ?? "PH",
    wmsLinkId: input.wmsLinkId,
    wmsLinkName: owner?.wmsLinkName ?? "",
    referenceNo: `NR${now.slice(0, 10).replaceAll("-", "")}${String(seq).padStart(3, "0")}`,
    itemCount: input.itemCount,
    attachmentUrl: input.attachmentUrl ?? null,
    memo: input.memo ?? null,
    relatedInboundId: null,
    submittedAt: now,
    registeredAt: null,
    createdAt: now,
    updatedAt: now,
  };
  wmsRequests = [newRequest, ...wmsRequests];
  return newRequest;
}
