import { z } from "zod";
import { redirect } from "next/navigation";
import {
  DEFAULT_PAGE_SIZE,
  WMS_LINK_ALL,
  inboundSortValue,
  toDomainInbound,
  wireInboundSchema,
  type Inbound,
  type InboundDateField,
  type InboundSearchParams,
  type Paginated,
  type WireInbound,
} from "@/types";
import { INBOUND_API } from "@/lib/api";
import { ApiError, getJavaApi } from "@/lib/api/server";
import { mockInbounds } from "@/lib/mock/inbounds";
import { mockClients } from "@/lib/mock/clients";
import { requireAccessToken, requireSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, sortItems } from "./utils";

/**
 * Inbound (입고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F001/F012/F013).
 *
 * 공개 함수 3개 — 응답을 Res 그대로 중계하는 BFF 전환(사용자 확정 2026-08-05)에 맞춘 구성:
 *  - getInboundWireRows: 목록 — Java GET /dtin 응답(행 배열)을 **Res 원문 그대로**(검증만)
 *    돌려준다. BFF(GET /api/dtin)가 이걸 그대로 응답한다 — devtools 응답 = Res.
 *  - getInboundCount: 건수 — GET /dtin/cnt(숫자). BFF(GET /api/dtin/cnt)가 그대로 응답.
 *  - getInbounds: 위 둘을 합성해 정규화(초→ms 등)까지 끝낸 Paginated<Inbound> — 페이지(서버)의
 *    SSR 초기 데이터용. 클라이언트 재조회는 화면이 와이어 배열을 받아 직접 정규화한다
 *    (변환 공유: types/inbound.ts의 wireInboundSchema·toDomainInbound).
 *
 * DATA_SOURCE=api(서버 env, .env.local/.env.production)일 때만 실 Java 호출로 나가고,
 * 그 외(미설정 포함)는 목데이터 경로를 그대로 탄다 — 목 폴백 유지(CLAUDE.md). 목 경로도
 * 와이어 모양(초·0)으로 되돌려 응답해 화면 코드패스가 하나로 유지된다.
 * 엔드포인트 정의(단일 출처): lib/api/inbound.ts INBOUND_API.
 *
 * ※ getInbound(단건)는 실 단건 엔드포인트가 없고 실제 호출부도 없다(행 상세는 목록이 이미
 * 받아 둔 행을 화면이 그대로 씀) — 그대로 목 배열 기반으로 남겨둔다.
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
 * CLIENT 스코핑용 이름 조회(목 폴백 전용) — 입고 행에는 클라이언트 ID가 없어(Swagger)
 * 이름(clntName)으로 잇는다. 실 API 경로는 이 함수를 쓰지 않는다 — /dtin Req에 클라이언트
 * 파라미터가 없어 Java가 토큰으로 스코핑한다고 추정되나 미확정(백엔드 확인 요청, 보고서 참조).
 */
function clientNameById(clientId: string): string | null {
  return mockClients.find((client) => client.id === clientId)?.name ?? null;
}

/** 0/음수/미지정을 기본값으로 좁힌 페이지 파라미터 — Req의 pageNo(0-기반)·pageSize와 1:1. */
function resolvePageParams(params: InboundSearchParams): { pageNo: number; pageSize: number } {
  return {
    pageNo: params.pageNo && params.pageNo > 0 ? Math.floor(params.pageNo) : 0,
    pageSize: params.pageSize && params.pageSize > 0 ? Math.floor(params.pageSize) : DEFAULT_PAGE_SIZE,
  };
}

// ── 목록/건수 — BFF가 Res 그대로 중계하는 공개 함수 ─────────────────────

/**
 * 입고 목록 — Java GET /dtin 응답(행 배열)을 Res 원문 그대로 돌려준다(행별 스키마 검증만
 * 하고 변형하지 않는다 — sipDt처럼 우리가 안 쓰는 필드도 응답에 그대로 남는다).
 * 목 폴백은 도메인 행을 와이어 모양(초·0)으로 되돌려 같은 계약을 유지한다.
 */
export async function getInboundWireRows(params: InboundSearchParams = {}): Promise<unknown[]> {
  if (process.env.DATA_SOURCE !== "api") {
    const { items } = await getMockInbounds(params);
    return items.map(toWireInbound);
  }
  await requireSession();
  const accessToken = await requireAccessToken();
  const { pageNo, pageSize } = resolvePageParams(params);
  const listQuery = { ...toInboundRequestQuery(params), pageNo, pageSize };
  const json = await readJavaJson(await getJavaApi(INBOUND_API.list, { query: listQuery, accessToken }), "GET /dtin");
  return validateWireRows(json);
}

/**
 * 입고 전체 건수 — Java GET /dtin/cnt(바디가 곧 숫자). Req는 목록과 동일 필터에 페이지
 * 파라미터만 없다(확정 스펙). 레거시 관례상 화면은 첫 페이지(pageNo 0) 조회에만 이걸 부른다.
 */
export async function getInboundCount(params: InboundSearchParams = {}): Promise<number> {
  if (process.env.DATA_SOURCE !== "api") {
    const { total } = await getMockInbounds(params);
    return total;
  }
  await requireSession();
  const accessToken = await requireAccessToken();
  const json = await readJavaJson(
    await getJavaApi(INBOUND_API.count, { query: toInboundRequestQuery(params), accessToken }),
    "GET /dtin/cnt",
  );
  return parseInboundCount(json);
}

/**
 * 목록+건수 합성 + 정규화까지 끝낸 Paginated<Inbound> — 페이지(서버)의 SSR 초기 데이터용.
 * - CLIENT 스코핑: Req에 클라이언트 파라미터가 없어 Java가 토큰으로 스코핑한다고 추정(미확정).
 * - 정렬: Req에 sort 파라미터가 없어(백엔드 확인 요청) 받은 페이지 안에서만 재정렬한다.
 */
export async function getInbounds(params: InboundSearchParams = {}): Promise<Paginated<Inbound>> {
  if (process.env.DATA_SOURCE !== "api") {
    return getMockInbounds(params);
  }
  const { pageNo, pageSize } = resolvePageParams(params);
  const [rowsJson, total] = await Promise.all([getInboundWireRows(params), getInboundCount(params)]);
  const rows = rowsJson.map((raw) => toDomainInbound(wireInboundSchema.parse(raw))); // validateWireRows 통과분이라 안전
  const sorted = sortItems(rows, params.sort, params.order, inboundSortValue);
  return { items: sorted, total, page: pageNo + 1, pageSize };
}

// ── 목 경로 ─────────────────────────────────────────────────────────

async function getMockInbounds(params: InboundSearchParams): Promise<Paginated<Inbound>> {
  await delay();
  const session = await requireSession();
  const scopedClientIds = resolveClientScope(session, undefined);
  // 실 계정의 clientIds(webClientIds)는 목 클라이언트 ID와 매칭되지 않으므로, 실 로그인한
  // CLIENT는 목 목록에서 0건을 보는 게 정상이다 — DATA_SOURCE=api로 전환하면 해소된다.
  const scopedNames = scopedClientIds
    ? new Set(scopedClientIds.map(clientNameById).filter((name): name is string => name !== null))
    : null;

  // 기간 경계(Req와 동일한 epoch 초) → ms — 행의 날짜(epoch ms)와 직접 비교한다.
  const startMs = params.startDt ? params.startDt * 1000 : null;
  const endMs = params.endDt ? params.endDt * 1000 : null;

  const filtered = inbounds.filter((row) => {
    if (scopedNames && (!row.clntName || !scopedNames.has(row.clntName))) return false;
    // 쿼리의 wmsLinkId는 문자열 — 행의 수치 ID(int)와 숫자로 비교한다. -100 = 전체(필터 없음).
    if (params.wmsLinkId && Number(params.wmsLinkId) !== WMS_LINK_ALL && row.wmsLinkId !== Number(params.wmsLinkId)) {
      return false;
    }
    if (params.status && row.status !== params.status) return false;
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
  // paginate는 1-기반 페이지를 받는다 — 프런트 계약의 pageNo(0-기반, Req 통일)를 변환.
  return paginate(sorted, (params.pageNo ?? 0) + 1, params.pageSize);
}

/** epoch ms|null → 와이어 표기(초, 값 없음 = 0) — 목 행을 Res 모양으로 되돌릴 때만 사용. */
function msToWireEpoch(ms: number | null): number {
  return ms ? Math.floor(ms / 1000) : 0;
}

/** 도메인 행 → 와이어 행(목 폴백 전용) — toDomainInbound의 역변환. */
function toWireInbound(row: Inbound): WireInbound {
  return {
    ...row,
    reqDt: msToWireEpoch(row.reqDt),
    etaDt: msToWireEpoch(row.etaDt),
    arvDt: msToWireEpoch(row.arvDt),
    dataRegDt: msToWireEpoch(row.dataRegDt),
    dataUpdDt: msToWireEpoch(row.dataUpdDt),
    regDt: msToWireEpoch(row.regDt),
    updDt: msToWireEpoch(row.updDt),
  };
}

// ── 실 API 경로 내부 조립 ─────────────────────────────────────────────

/** searchDt 미지정 시의 기본 기준일자(Req에서 필수라 항상 보낸다) — 목 구현(resolveDate 기본 분기)과 동일하게 맞춘다. */
const DEFAULT_DATE_FIELD: InboundDateField = "REQ_DT";

/**
 * startDt/endDt는 필수(아래 참조)라 사용자가 기간을 비워도 값을 보내야 한다 — "전체 기간"을
 * 뜻하는 최광역 경계(epoch 초). 0은 Java가 400으로 거부해 1초부터(실서버 프로브 2026-08-05),
 * 상한 2100-01-01은 허용 확인. 검색 패널의 "빈 기간 = 전체 조회" 의미는 그대로 유지된다.
 */
const FULL_RANGE_START_SEC = 1; // 1970-01-01 00:00:01 UTC — 0은 400
const FULL_RANGE_END_SEC = 4_102_444_800; // 2100-01-01 00:00:00 UTC

/**
 * InboundSearchParams(프런트 계약 — 필드명·의미가 Req와 동일, 2026-08-05 통일) → Java Req.
 * 날짜 문자열 → epoch 초 변환은 화면(lib/utils/datetime.toEpochSeconds)이 이미 끝냈고,
 * 여기서는 프런트가 못 채운 빈 값의 기본치만 채운다. pageNo/pageSize는 호출부가 목적에
 * 따라 덧붙인다(건수 조회는 페이지 파라미터가 없다 — Req 확정 스펙).
 *
 * 필수/선택 확정(실서버 프로브 2026-08-05): startDt·endDt·searchDt는 /dtin·/dtin/cnt 공통
 * 필수(하나라도 빠지면 400 — 바디에 errorCode 없음), /dtin은 pageNo·pageSize도 필수.
 * status·search만 선택. 그래서 기간·기준일자·wmsLinkId는 항상 채워 보낸다.
 */
function toInboundRequestQuery(params: InboundSearchParams): Record<string, string | number | undefined> {
  return {
    wmsLinkId: params.wmsLinkId || WMS_LINK_ALL,
    startDt: params.startDt ?? FULL_RANGE_START_SEC,
    endDt: params.endDt ?? FULL_RANGE_END_SEC,
    searchDt: params.searchDt ?? DEFAULT_DATE_FIELD,
    status: params.status,
    search: params.search,
  };
}

/** GET /dtin/cnt 응답 — 바디가 곧 숫자(전역 래핑 없음 확정). */
const inboundCountSchema = z.number().int().nonnegative();

/**
 * 업스트림 Response를 검증한다: 네트워크 실패/401/그 외 실패를 구분해 처리하고, 성공이면
 * JSON 바디를 돌려준다. 401은 proxy의 선제 갱신이 커버 못한(리프레시까지 만료된) 드문
 * 경우인데, RSC 렌더 중에는 쿠키를 못 지우므로(Next.js 제약) 여기서는 로그인으로만 보낸다
 * — 쿠키 정리는 로그아웃 플로우(app/api/auth/logout)나 다음 로그인의 덮어쓰기가 담당한다.
 * (BFF 라우트에서 redirect는 307 응답이 되며, axios 호출부의 401 처리와는 별개 경로다.)
 */
async function readJavaJson(res: Response | null, label: string): Promise<unknown> {
  if (!res) {
    console.error(`[lib/data/inbounds] ${label} 호출 실패(네트워크 연결 불가)`);
    throw new ApiError(502, "입고 데이터를 불러오지 못했습니다.");
  }
  if (res.status === 401) {
    redirect("/login");
  }
  if (!res.ok) {
    // Java 에러 바디(javaApiErrorSchema 형태)를 로그에 남긴다 — 400 원인 파라미터 추적용.
    const body = await res.text().catch(() => "");
    console.error(`[lib/data/inbounds] ${label} 실패: HTTP ${res.status}${body ? ` — ${body.slice(0, 500)}` : ""}`);
    throw new ApiError(res.status, "입고 데이터를 불러오지 못했습니다.");
  }
  return res.json().catch(() => null);
}

/**
 * GET /dtin 응답 바디가 "행 배열 + 행별 스키마 일치"인지 검증하고 **원문 그대로** 돌려준다
 * — 변형(정규화)은 받는 쪽(화면/getInbounds) 몫이라 여기서 하지 않는다(zod parse 반환값을
 * 쓰면 스키마 밖 필드(sipDt 등)가 잘려 Res 원문이 훼손된다).
 */
function validateWireRows(json: unknown): unknown[] {
  if (!Array.isArray(json)) {
    console.error("[lib/data/inbounds] GET /dtin 응답이 배열이 아닙니다:", json);
    throw new ApiError(502, "입고 목록 응답 형식이 올바르지 않습니다.");
  }
  json.forEach((raw, index) => {
    const parsed = wireInboundSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[lib/data/inbounds] GET /dtin 응답 ${index}번째 행이 wireInboundSchema와 다릅니다:`,
        parsed.error.issues,
      );
      throw new ApiError(502, "입고 목록 응답 형식이 올바르지 않습니다.");
    }
  });
  return json;
}

/** GET /dtin/cnt 응답 바디(숫자)를 검증한다. */
function parseInboundCount(json: unknown): number {
  const parsed = inboundCountSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[lib/data/inbounds] GET /dtin/cnt 응답이 숫자가 아닙니다:", json, parsed.error.issues);
    throw new ApiError(502, "입고 건수 응답 형식이 올바르지 않습니다.");
  }
  return parsed.data;
}

export async function getInbound(idx: number): Promise<Inbound | null> {
  await delay();
  const session = await requireSession();
  const row = inbounds.find((r) => r.idx === idx) ?? null;
  if (!row) return null;
  if (session.role === "CLIENT") {
    const ownedNames = (session.clientIds ?? []).map(clientNameById);
    if (!row.clntName || !ownedNames.includes(row.clntName)) return null;
  }
  return row;
}
