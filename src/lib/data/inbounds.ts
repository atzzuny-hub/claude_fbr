import {
  COUNTRY_LABEL,
  INBOUND_STATUS,
  type Inbound,
  type InboundDateField,
  type InboundSearchParams,
  type Paginated,
} from "@/types";
import { mockInbounds } from "@/lib/mock/inbounds";
import { mockClients } from "@/lib/mock/clients";
import { getSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, sortItems, withinDateTimeRange } from "./utils";

/**
 * Inbound (입고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F001/F012/F013).
 * 도메인 스키마는 입고 목록 API(Swagger 확정) 응답 그대로다 — 날짜는 UTC epoch ms.
 * Phase 2에서는 이 파일 내부만 BFF 호출로 교체한다: dateFrom/dateTo → startDt/endDt(epoch),
 * dateField → searchDt, keyword → search, page → pageNo(0-base), status/wmsLinkId는 그대로.
 * 전체 건수(total)는 목록과 별도 엔드포인트 `/dtin/cnt`로 조회한다(Swagger 확정) — Req는
 * 목록과 같은 필터에 페이지 파라미터만 없다. getInbounds가 내부에서 목록+건수 두 호출을
 * 합성해 Paginated<Inbound>를 유지하므로 호출부(화면)는 바뀌지 않는다.
 * ※ Req의 startDt/endDt 예시는 10자리(초)라 응답(ms)과 단위가 다르다 — 변환 시 확인 필요.
 */
const inbounds: Inbound[] = [...mockInbounds];

/** searchDt(기준일자) 코드 → 행의 해당 날짜(epoch ms). 미도래 단계는 null → 기간 검색에서 제외. */
function resolveDate(row: Inbound, dateField?: InboundDateField): number | null {
  switch (dateField) {
    case "WRHS_DT": // 창고도착일
      return row.arvDt;
    case "CMPL_DT":
      // 입고완료일 — 응답에 대응 필드가 없어(Swagger 재확인 대상) 완료 행의 마지막 변경
      // 시각으로 근사한다. 완료되지 않은 행은 완료일 기준 검색에 걸리지 않는 게 맞다.
      return row.status === "COMPLETED" ? (row.updDt ?? row.arvDt) : null;
    case "REQ_DT": // 입고접수일
    default:
      return row.reqDt;
  }
}

/**
 * 정렬 값 접근자 — sort 키(= 목록 컬럼 key)별 비교 기준값을 돌려준다.
 *  - status: 파이프라인 순서(예정→대기→입고→취소→알 수 없음)로 정렬되게 enum 인덱스를 쓴다.
 *  - country: 화면에 보이는 한글 국가명 기준(사용자가 보는 순서와 일치).
 *  - 날짜 3종: epoch(ms) 수치 비교. 아직 없는 값(null)은 sortItems가 항상 뒤로 보낸다.
 *  - 모르는 키: null → 정렬 안 함(원본 순서 유지).
 */
function inboundSortValue(row: Inbound, key: string): string | number | null {
  switch (key) {
    case "ganNo":
      return row.ganNo;
    case "status":
      return INBOUND_STATUS.indexOf(row.status);
    case "country":
      return COUNTRY_LABEL[row.cntyCd];
    case "wmsLink":
      return row.wmsLinkName;
    case "reqDt":
      return row.reqDt;
    case "etaDt":
      return row.etaDt;
    case "arvDt":
      return row.arvDt;
    default:
      return null;
  }
}

/**
 * CLIENT 스코핑용 이름 조회 — 입고 행에는 클라이언트 ID가 없어(Swagger) 이름(clntName)으로
 * 잇는다. Phase 2에서는 Java API가 세션 토큰으로 스코핑하므로 이 함수는 통째로 사라진다.
 */
function clientNameById(clientId: string): string | null {
  return mockClients.find((client) => client.id === clientId)?.name ?? null;
}

export async function getInbounds(params: InboundSearchParams = {}): Promise<Paginated<Inbound>> {
  await delay();
  const session = await getSession();
  const scopedClientId = resolveClientScope(session, undefined);
  const scopedClientName = scopedClientId ? clientNameById(scopedClientId) : null;

  const filtered = inbounds.filter((row) => {
    if (scopedClientName && row.clntName !== scopedClientName) return false;
    // URL 쿼리의 wmsLinkId는 문자열 — 행의 수치 ID(int)와 숫자로 비교한다.
    if (params.wmsLinkId && row.wmsLinkId !== Number(params.wmsLinkId)) return false;
    if (params.status && row.status !== params.status) return false;
    // 기간 비교는 날짜+시:분 단위(UTC) — Req의 startDt/endDt 정밀도·화면 표시와 같은 기준.
    if (!withinDateTimeRange(resolveDate(row, params.dateField), params.dateFrom, params.dateTo)) {
      return false;
    }
    if (
      !matchesKeyword(
        params.keyword,
        row.ganNo,
        row.clntName,
        row.contactName,
        row.dataId,
        row.wmsLinkName,
        // 제품 목록의 SKU/상품명도 검색 대상에 포함(상세에 보이는 상품으로도 찾을 수 있게)
        ...row.prodList.flatMap((prod) => [prod.sku, prod.productName]),
      )
    ) {
      return false;
    }
    return true;
  });
  const sorted = sortItems(filtered, params.sort, params.order, inboundSortValue);
  return paginate(sorted, params.page, params.pageSize);
}

export async function getInbound(idx: number): Promise<Inbound | null> {
  await delay();
  const session = await getSession();
  const row = inbounds.find((r) => r.idx === idx) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT") {
    const scopedName = session.clientId ? clientNameById(session.clientId) : null;
    if (!scopedName || row.clntName !== scopedName) return null;
  }
  return row;
}
