import {
  WMS_LINK_ALL,
  outboundSortValue,
  type Outbound,
  type OutboundDateField,
  type OutboundSearchParams,
  type Paginated,
} from "@/types";
import { mockOutbounds } from "@/lib/mock/outbounds";
import { mockClients } from "@/lib/mock/clients";
import { requireSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, sortItems } from "./utils";

/**
 * Outbound (출고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F002/F012/F013).
 *
 * 타입·검색 파라미터는 Swagger(GET /dtob, 2026-08-06 확인) 계약으로 정합됐고, 여기는 아직
 * 목 경로만 있다 — 실 API 전환(BFF·와이어 중계·DATA_SOURCE 스위치)은 입고(lib/data/
 * inbounds.ts)와 같은 구성으로 다음 단계에 붙인다(getOutboundWireRows/getOutboundCount
 * 분리, /dtob·/dtob/cnt·/dtob/dn). 필터 의미는 Req와 1:1: wmsLinkId(-100=전체)·기간
 * (searchDt 기준)·status/delivery(배열 — 다중 선택)·search.
 */
const outbounds: Outbound[] = [...mockOutbounds];

/** searchDt(기준일자) 코드 → 행의 해당 날짜(epoch ms). 미도래 단계는 null → 기간 검색에서 제외. */
function resolveDate(row: Outbound, dateField?: OutboundDateField): number | null {
  switch (dateField) {
    case "DELIVERY_DT": // 배송일 — 배송상태 변경일
      return row.deliveryDt;
    case "ORDER_DT": // 주문일
    default:
      return row.orderDt;
  }
}

/**
 * CLIENT 스코핑용 이름 조회(목 폴백 전용) — 출고 행에도 클라이언트 ID가 없어(Swagger,
 * clntName뿐) 이름으로 잇는다. 실 API 경로는 입고와 동일하게 Java 토큰 스코핑 추정(미확정).
 */
function clientNameById(clientId: string): string | null {
  return mockClients.find((client) => client.id === clientId)?.name ?? null;
}

export async function getOutbounds(params: OutboundSearchParams = {}): Promise<Paginated<Outbound>> {
  await delay();
  const session = await requireSession();
  const scopedClientIds = resolveClientScope(session, undefined);
  const scopedNames = scopedClientIds
    ? new Set(scopedClientIds.map(clientNameById).filter((name): name is string => name !== null))
    : null;

  // 기간 경계(Req와 동일한 epoch 초) → ms — 행의 날짜(epoch ms)와 직접 비교한다.
  const startMs = params.startDt ? params.startDt * 1000 : null;
  const endMs = params.endDt ? params.endDt * 1000 : null;

  const filtered = outbounds.filter((row) => {
    if (scopedNames && (!row.clntName || !scopedNames.has(row.clntName))) return false;
    // 쿼리의 wmsLinkId는 문자열 — 행의 수치 ID(int)와 숫자로 비교한다. -100 = 전체(필터 없음).
    if (params.wmsLinkId && Number(params.wmsLinkId) !== WMS_LINK_ALL && row.wmsLinkId !== Number(params.wmsLinkId)) {
      return false;
    }
    // status/delivery는 배열(다중 선택, Req 확정) — 비어 있으면 전체.
    if (params.status?.length && !(params.status as readonly string[]).includes(row.status)) return false;
    if (params.delivery?.length) {
      if (row.delivery === null || !(params.delivery as readonly string[]).includes(row.delivery)) return false;
    }
    if (startMs || endMs) {
      const value = resolveDate(row, params.searchDt);
      if (value === null) return false; // 기간 검색인데 기준 날짜가 아직 없는 행은 제외
      if (startMs && value < startMs) return false;
      if (endMs && value > endMs) return false;
    }
    if (
      !matchesKeyword(
        params.search,
        row.ganNo,
        row.clntName,
        row.marketName,
        row.trackingNo,
        row.dataId,
        row.wmsLinkName,
        row.receiver?.name ?? null,
        // 제품 목록의 SKU/상품명도 검색 대상에 포함(입고와 동일 관례 — 한국어 상품명까지)
        ...row.prodList.flatMap((prod) => [prod.sku, prod.productName, prod.productNameKr]),
      )
    ) {
      return false;
    }
    return true;
  });
  const sorted = sortItems(filtered, params.sort, params.order, outboundSortValue);
  // paginate는 1-기반 페이지를 받는다 — 프런트 계약의 pageNo(0-기반, Req 통일)를 변환.
  return paginate(sorted, (params.pageNo ?? 0) + 1, params.pageSize);
}

export async function getOutbound(idx: number): Promise<Outbound | null> {
  await delay();
  const session = await requireSession();
  const row = outbounds.find((r) => r.idx === idx) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT") {
    const ownedNames = (session.clientIds ?? []).map(clientNameById);
    if (!row.clntName || !ownedNames.includes(row.clntName)) return null;
  }
  return row;
}
