import { z } from "zod";
import { redirect } from "next/navigation";
import {
  countryLabel,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  INBOUND_STATUS,
  inboundSchema,
  type Inbound,
  type InboundDateField,
  type InboundSearchParams,
  type Paginated,
} from "@/types";
import { INBOUND_API } from "@/lib/api";
import { ApiError, getJavaApi } from "@/lib/api/server";
import { mockInbounds } from "@/lib/mock/inbounds";
import { mockClients } from "@/lib/mock/clients";
import { requireAccessToken, requireSession, resolveClientScope } from "./session";
import { delay, matchesKeyword, paginate, sortItems, withinDateTimeRange } from "./utils";

/**
 * Inbound (입고현황) — 클라이언트 소유 + 물류 모델, 역할 스코핑 대상(F001/F012/F013).
 * 도메인 스키마는 입고 목록 API(Swagger 확정) 응답 그대로다 — 날짜는 UTC epoch ms.
 *
 * DATA_SOURCE=api(서버 env, .env.local/.env.production)일 때만 실 Java 호출로 나가고,
 * 그 외(미설정 포함)는 기존 목데이터 경로를 그대로 탄다 — 목 폴백 유지(CLAUDE.md).
 * 엔드포인트 정의(단일 출처): lib/api/inbound.ts INBOUND_API — 목록 list(/dtin) ·
 * 건수 count(/dtin/cnt). 건수는 목록과 같은 필터에 페이지 파라미터만 없다. getInbounds가
 * 내부에서 목록+건수 두 호출을 합성해 Paginated<Inbound>를 유지하므로 호출부(화면)는 바뀌지 않는다.
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
      return countryLabel(row.cntyCd);
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
 * CLIENT 스코핑용 이름 조회(목 폴백 전용) — 입고 행에는 클라이언트 ID가 없어(Swagger)
 * 이름(clntName)으로 잇는다. 실 API 경로(getApiInbounds)는 이 함수를 쓰지 않는다 —
 * /dtin Req에 클라이언트 파라미터가 없어 Java가 토큰으로 스코핑한다고 추정되나 미확정
 * (백엔드 확인 요청, 보고서 참조).
 */
function clientNameById(clientId: string): string | null {
  return mockClients.find((client) => client.id === clientId)?.name ?? null;
}

export async function getInbounds(params: InboundSearchParams = {}): Promise<Paginated<Inbound>> {
  if (process.env.DATA_SOURCE !== "api") {
    return getMockInbounds(params);
  }
  return getApiInbounds(params);
}

async function getMockInbounds(params: InboundSearchParams): Promise<Paginated<Inbound>> {
  await delay();
  const session = await requireSession();
  const scopedClientIds = resolveClientScope(session, undefined);
  // 실 계정의 clientIds(webClientIds)는 목 클라이언트 ID와 매칭되지 않으므로, 실 로그인한
  // CLIENT는 목 목록에서 0건을 보는 게 정상이다 — DATA_SOURCE=api로 전환하면 해소된다.
  const scopedNames = scopedClientIds
    ? new Set(scopedClientIds.map(clientNameById).filter((name): name is string => name !== null))
    : null;

  const filtered = inbounds.filter((row) => {
    if (scopedNames && (!row.clntName || !scopedNames.has(row.clntName))) return false;
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

// ── 실 API 경로 ──────────────────────────────────────────────────────

/** dateField 미지정 시의 기본 기준일자(searchDt는 필수라 항상 보낸다) — 목 구현(resolveDate 기본 분기)과 동일하게 맞춘다. */
const DEFAULT_DATE_FIELD: InboundDateField = "REQ_DT";

/**
 * 검색 패널의 날짜("YYYY-MM-DD")/날짜시간("YYYY-MM-DDTHH:mm[:ss]") 문자열 → epoch 초(10자리, UTC).
 * 날짜만 오면(길이 10) 시작 00:00:00 · 종료 23:59:59로 확장한다(검색 패널은 날짜만 받는다 —
 * 사용자 확정. 종료 경계 :59초는 레거시 요청 캡처와 동일 — 23:59:00이면 마지막 59초 행이 빠진다).
 * Date.UTC로 직접 조립하는 이유: new Date(문자열)은 Node 서버의 TZ 설정에 좌우될 수 있어,
 * 응답을 UTC 그대로 표시·비교해 온 기존 관례(lib/utils/datetime.formatEpoch*,
 * lib/data/utils.withinDateTimeRange의 toISOString 비교)와 어긋날 위험이 있다 — UTC로 고정한다.
 */
function toEpochSeconds(dateBound: string, endOfDay: boolean): number {
  const normalized =
    dateBound.length === 10 ? `${dateBound}T${endOfDay ? "23:59:59" : "00:00:00"}` : dateBound.slice(0, 19);
  const [datePart, timePart] = normalized.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = (timePart ?? "00:00:00").split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute, second || 0) / 1000);
}

/**
 * startDt/endDt는 필수(아래 참조)라 사용자가 기간을 비워도 값을 보내야 한다 — "전체 기간"을
 * 뜻하는 최광역 경계(epoch 초). 0은 Java가 400으로 거부해 1초부터(실서버 프로브 2026-08-05),
 * 상한 2100-01-01은 허용 확인. 검색 패널의 "빈 기간 = 전체 조회" 의미는 그대로 유지된다.
 */
const FULL_RANGE_START_SEC = 1; // 1970-01-01 00:00:01 UTC — 0은 400
const FULL_RANGE_END_SEC = 4_102_444_800; // 2100-01-01 00:00:00 UTC

/**
 * 전체 WMS LINK 조회 센티널 — 레거시 요청 캡처로 확정(사용자 제공 2026-08-05).
 * wmsLinkId를 아예 빼면 에러가 아니라 **조용히 0건**이 온다(실서버 프로브) — 함정이므로
 * 미선택 시 반드시 -100을 보낸다.
 */
const WMS_LINK_ALL = -100;

/**
 * InboundSearchParams(프런트 검색 상태 계약) → Java Req 필드. page/pageSize는 호출부가
 * 목적에 따라 덧붙인다(건수 조회는 페이지 파라미터가 없다 — Req 확정 스펙).
 *
 * 필수/선택 확정(실서버 프로브 2026-08-05): startDt·endDt·searchDt는 /dtin·/dtin/cnt 공통
 * 필수(하나라도 빠지면 400 — 바디에 errorCode 없음), /dtin은 pageNo·pageSize도 필수.
 * wmsLinkId·status·search만 선택. 그래서 기간·기준일자는 항상 채워 보낸다.
 */
function toInboundRequestQuery(params: InboundSearchParams): Record<string, string | number | undefined> {
  return {
    wmsLinkId: params.wmsLinkId || WMS_LINK_ALL,
    startDt: params.dateFrom ? toEpochSeconds(params.dateFrom, false) : FULL_RANGE_START_SEC,
    endDt: params.dateTo ? toEpochSeconds(params.dateTo, true) : FULL_RANGE_END_SEC,
    searchDt: params.dateField ?? DEFAULT_DATE_FIELD,
    status: params.status,
    search: params.keyword,
  };
}

/** GET /dtin/cnt 응답 — 바디가 곧 숫자(전역 래핑 없음 확정). */
const inboundCountSchema = z.number().int().nonnegative();

/**
 * 업스트림 Response를 검증한다: 네트워크 실패/401/그 외 실패를 구분해 처리하고, 성공이면
 * JSON 바디를 돌려준다. 401은 proxy의 선제 갱신이 커버 못한(리프레시까지 만료된) 드문
 * 경우인데, RSC 렌더 중에는 쿠키를 못 지우므로(Next.js 제약) 여기서는 로그인으로만 보낸다
 * — 쿠키 정리는 로그아웃 플로우(app/api/auth/logout)나 다음 로그인의 덮어쓰기가 담당한다.
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

// ── 와이어 정규화(실서버 실측 2026-08-05 — Swagger 표기와 다른 확정분) ──────────
// ① 응답 날짜는 epoch "초"다(문서 표기는 ms — 실측 우선). ② 값 없음은 null이 아니라 0.
// ③ status에 문서 밖 값이 실재한다(WORK, 원본코드 20 — "실재하지 않는 값"이라던 기존 확인과
// 상충, 사용자 확정 대기). 도메인 모델(inboundSchema: epoch ms · null · 확정 enum)은
// 화면·목·CSV·정렬의 공통 전제라 그대로 두고, 실 API 경계인 여기서만 변환한다.

/** 와이어 행 스키마 — status만 임의 문자열로 느슨하게 받고(→ toDomainInbound에서 판정),
 * 날짜는 와이어에선 0이 올 수 있어 non-null 수치로 받는다(reqDt/regDt — 도메인은 nullable). */
const wireInboundSchema = inboundSchema.extend({
  status: z.string(),
  reqDt: z.number().int(),
  regDt: z.number().int(),
});

/** epoch 초 → ms. 0 = 값 없음(실측: etaDt/arvDt 미도래 단계) → null. */
function wireEpochToMs(sec: number | null): number | null {
  return sec ? sec * 1000 : null;
}

function toDomainInbound(wire: z.infer<typeof wireInboundSchema>): Inbound {
  const known = (INBOUND_STATUS as readonly string[]).includes(wire.status);
  if (!known) {
    // WORK 등 미확정 상태 — 표시명·필터 취급이 확정될 때까지 UNKNOW("알 수 없음")로 강등.
    console.warn(`[lib/data/inbounds] 미확정 입고상태 "${wire.status}" (idx ${wire.idx}) — UNKNOW로 표시`);
  }
  return {
    ...wire,
    status: known ? (wire.status as Inbound["status"]) : "UNKNOW",
    // reqDt/regDt 포함 전부 0→null: 명세상 필수인 접수일도 실데이터엔 0인 행이 있다(WORK 실측)
    reqDt: wireEpochToMs(wire.reqDt),
    etaDt: wireEpochToMs(wire.etaDt),
    arvDt: wireEpochToMs(wire.arvDt),
    dataRegDt: wireEpochToMs(wire.dataRegDt),
    dataUpdDt: wireEpochToMs(wire.dataUpdDt),
    regDt: wireEpochToMs(wire.regDt),
    updDt: wireEpochToMs(wire.updDt),
  };
}

/** GET /dtin 응답 바디(행 배열)를 와이어 스키마로 검증 후 도메인 행으로 정규화한다. */
function parseInboundRows(json: unknown): Inbound[] {
  if (!Array.isArray(json)) {
    console.error("[lib/data/inbounds] GET /dtin 응답이 배열이 아닙니다:", json);
    throw new ApiError(502, "입고 목록 응답 형식이 올바르지 않습니다.");
  }
  return json.map((raw, index) => {
    const parsed = wireInboundSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[lib/data/inbounds] GET /dtin 응답 ${index}번째 행이 wireInboundSchema와 다릅니다:`,
        parsed.error.issues,
      );
      throw new ApiError(502, "입고 목록 응답 형식이 올바르지 않습니다.");
    }
    return toDomainInbound(parsed.data);
  });
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

/**
 * 실 Java API 경로 — GET /dtin(목록) + GET /dtin/cnt(건수)를 합성해 Paginated<Inbound>를 만든다.
 *
 * - CLIENT 스코핑: Req에 클라이언트 파라미터가 없어 프론트가 강제할 수단이 없다 — Java가
 *   세션 토큰으로 스코핑한다고 추정되나 미확정(백엔드 확인 요청, 보고서 참조). 따라서 여기서는
 *   resolveClientScope/clientNameById(목 전용)를 쓰지 않는다.
 * - 페이지 파라미터: page(1-base) → pageNo(0-base), pageSize는 그대로.
 * - 건수는 페이지와 무관하게 매 호출 조회한다(레거시는 1페이지일 때만 조회해 절약했지만,
 *   Paginated<T>.total은 시그니처상 페이지 이동 후에도 정확해야 DataTable 페이지네이션이
 *   깨지지 않는다 — 정확성을 절약보다 우선했다).
 * - 정렬: Req에 sort 파라미터가 없어(백엔드 확인 요청) 응답받은 "그 페이지 안에서만" 정렬한다.
 *   기본 페이지 크기(500)가 대부분의 검색 결과를 한 페이지에 담아 실사용상 전체 정렬과 크게
 *   다르지 않지만, 매칭 건수가 페이지 크기를 넘으면 다른 페이지 행과는 섞이지 않는다.
 */
async function getApiInbounds(params: InboundSearchParams): Promise<Paginated<Inbound>> {
  await requireSession(); // 인증 가드(비로그인 → /login) — 값 자체는 스코핑에 쓰지 않는다(위 주석)
  const accessToken = await requireAccessToken();

  // paginate()의 기본값 해석과 동일 규칙(0/음수/미지정은 기본값) — Java가 페이지를 대신 잘라주므로
  // 여기서 자르지는 않고 pageNo/pageSize 변환에만 쓴다.
  const page = params.page && params.page > 0 ? Math.floor(params.page) : DEFAULT_PAGE;
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.floor(params.pageSize) : DEFAULT_PAGE_SIZE;

  const filterQuery = toInboundRequestQuery(params);
  const listQuery = { ...filterQuery, pageNo: page - 1, pageSize };

  const [listRes, countRes] = await Promise.all([
    getJavaApi(INBOUND_API.list, { query: listQuery, accessToken }),
    getJavaApi(INBOUND_API.count, { query: filterQuery, accessToken }),
  ]);

  const [listJson, countJson] = await Promise.all([
    readJavaJson(listRes, "GET /dtin"),
    readJavaJson(countRes, "GET /dtin/cnt"),
  ]);

  const rows = parseInboundRows(listJson);
  const sorted = sortItems(rows, params.sort, params.order, inboundSortValue);
  const total = parseInboundCount(countJson);

  return { items: sorted, total, page, pageSize };
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
