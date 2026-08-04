// PRD: F001(입고현황 조회), F012(목록 검색·엑셀 다운로드), F013(역할별 데이터 스코핑)
// — 입고현황 페이지 (접근 권한: 공통·데이터 스코핑, 로그인 후 기본 진입 화면)
import { getInbounds, getWmsLinks, requireSession } from "@/lib/data";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  INBOUND_DATE_FIELD,
  INBOUND_DATE_FIELD_LABEL,
  INBOUND_STATUS_FILTER,
  INBOUND_STATUS_LABEL,
  inboundSearchParamsSchema,
  type InboundSearchParams,
} from "@/types";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { PageHeader } from "@/components/common/page-header";
import { SearchPanel, type SelectOption } from "@/components/common/search-panel";
import { InboundTable } from "./_components/inbound-table";
import { InboundDownloadButton } from "./_components/inbound-download-button";

// 기준일자 후보 = Req의 searchDt 코드(입고접수일 REQ_DT · 창고도착일 WRHS_DT · 입고완료일 CMPL_DT).
// 입고완료일은 응답에 표시할 필드가 없어 목록 컬럼에는 없다(검색 기준으로만 존재 — TBD 참조).
const DATE_FIELD_OPTIONS: SelectOption[] = INBOUND_DATE_FIELD.map((field) => ({
  value: field,
  label: INBOUND_DATE_FIELD_LABEL[field],
}));

// 입고상태 필터 옵션 — Req의 status enum(PLAN/STANDBY/COMPLETED/CANCELED)과 1:1.
// UNKNOW는 응답 전용 값이라 필터에 없다. 표시명은 INBOUND_STATUS_LABEL 그대로(라벨 임의 변경 금지).
const STATUS_OPTIONS: SelectOption[] = INBOUND_STATUS_FILTER.map((status) => ({
  value: status,
  label: INBOUND_STATUS_LABEL[status],
}));

// F012 "검색결과 전체 다운로드"용 상한 — 현재 목데이터 규모(64건) 대비 충분히 큰 값.
const EXPORT_MAX_ROWS = 1000;

interface InboundPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InboundPage({ searchParams }: InboundPageProps) {
  const flat = flattenSearchParams(await searchParams);
  const page = Number(flat.page) > 0 ? Number(flat.page) : DEFAULT_PAGE;
  const pageSize = Number(flat.pageSize) > 0 ? Number(flat.pageSize) : DEFAULT_PAGE_SIZE;

  // URL 쿼리는 신뢰할 수 없는 입력이므로 lib/data에 넘기기 전 zod로 좁힌다.
  // status/dateField가 enum을 벗어나면(catch) 해당 필드만 무시되고 나머지 필터는 유지된다.
  const parsed = inboundSearchParamsSchema.safeParse({
    dateFrom: flat.dateFrom || undefined,
    dateTo: flat.dateTo || undefined,
    dateField: flat.dateField || undefined,
    wmsLinkId: flat.wmsLinkId || undefined,
    status: flat.status || undefined,
    keyword: flat.keyword || undefined,
    sort: flat.sort || undefined,
    order: flat.order || undefined,
    page,
    pageSize,
  });
  const params: InboundSearchParams = parsed.success ? parsed.data : { page, pageSize };

  const [session, inbounds, exportResult, wmsLinksResult] = await Promise.all([
    requireSession(),
    getInbounds(params),
    getInbounds({ ...params, page: 1, pageSize: EXPORT_MAX_ROWS }),
    getWmsLinks({ pageSize: 100 }),
  ]);

  // 필터 옵션 value = 입고 행이 참조하는 수치 ID(idx) — Req의 wmsLinkId(int)와 1:1.
  const wmsLinkOptions: SelectOption[] = wmsLinksResult.items.map((link) => ({
    value: String(link.idx),
    label: link.name,
  }));

  return (
    // lg 이상: 셸이 준 높이를 그대로 채워 목록이 화면 안에 들어오고, 표 안에서만 스크롤된다.
    // lg 미만: 검색 조건이 여러 줄로 감겨 표에 남는 높이가 얇아지므로 페이지 전체 스크롤로 둔다.
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <PageHeader
        title="입고현황"
        // 홈(REVE-ON)은 PageHeader가 항상 붙인다 — 현재 페이지라 href는 주지 않는다
        breadcrumbs={[{ label: "입고현황" }]}
        className="shrink-0"
        // actions={ // 추후 버튼이 들어갈 자리.. }
      />

      {/* 이 화면의 검색 조건 = WMS LINK · 시작일 · 종료일 · 기준일자 · 입고상태 · 검색어.
       * 입고 목록 Req(Swagger 확정)에 클라이언트·국가 파라미터가 없으므로 두 필터는 노출하지
       * 않는 것으로 확정 — 다른 목록 화면은 각자 Swagger 확인 시 결정한다(CLAUDE.md TBD).
       * CLIENT 데이터 격리는 그대로 서버 스코핑(lib/data → Phase 2 API)이 담당한다. */}
      <SearchPanel
        basePath="/inbound"
        role={session.role}
        wmsLinkOptions={wmsLinkOptions}
        dateFieldOptions={DATE_FIELD_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        statusLabel="입고상태"
        keywordPlaceholder="접수번호 · SKU · 상품명 검색"
        defaultValues={params}
        className="shrink-0"
      />

      <InboundTable
        data={inbounds.items}
        total={inbounds.total}
        page={inbounds.page}
        pageSize={inbounds.pageSize}
        currentQuery={flat}
        // 표 상단 툴바에 놓을 "검색결과 전체 다운로드"(F012) — 전체 검색결과(exportResult)로 렌더.
        // 서버에서 클라이언트 컴포넌트 엘리먼트를 만들어 prop으로 넘긴다(data만 직렬화 전달).
        // key: 서버→클라이언트로 넘긴 엘리먼트를 자식으로 렌더할 때 React key 경고를 막는다.
        toolbarActions={<InboundDownloadButton key="inbound-download" data={exportResult.items} />}
      />
    </div>
  );
}
