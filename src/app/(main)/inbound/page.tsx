// PRD: F001(입고현황 조회), F012(목록 검색·엑셀 다운로드), F013(역할별 데이터 스코핑)
// — 입고현황 페이지 (접근 권한: 공통·데이터 스코핑, 로그인 후 기본 진입 화면)
import { getInbounds, getSession, getWmsLinks } from "@/lib/data";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  INBOUND_STATUS,
  INBOUND_STATUS_LABEL,
  inboundSearchParamsSchema,
  type InboundSearchParams,
} from "@/types";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { PageHeader } from "@/components/common/page-header";
import { SearchPanel, type SelectOption } from "@/components/common/search-panel";
import { InboundTable } from "./_components/inbound-table";
import { InboundDownloadButton } from "./_components/inbound-download-button";

// 기준일자 후보 = 목록의 날짜 컬럼 3개와 동일 (lib/data/inbounds.ts의 resolveDate 허용값과 1:1)
const DATE_FIELD_OPTIONS: SelectOption[] = [
  { value: "receiptDate", label: "입고접수일" },
  { value: "arrivalDate", label: "창고도착일" },
  { value: "completedDate", label: "입고 완료일" },
];

// 입고상태 필터 옵션 — 진행 3단계(예정 → 대기 → 입고) + 종료 상태(취소).
// 표시명은 types/status.ts의 INBOUND_STATUS_LABEL을 그대로 쓴다(라벨 임의 변경 금지).
const STATUS_OPTIONS: SelectOption[] = INBOUND_STATUS.map((status) => ({
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
  // status/country가 enum을 벗어나면 해당 필드만 무시되고 나머지 필터는 유지된다.
  const parsed = inboundSearchParamsSchema.safeParse({
    dateFrom: flat.dateFrom || undefined,
    dateTo: flat.dateTo || undefined,
    dateField: flat.dateField || undefined,
    wmsLinkId: flat.wmsLinkId || undefined,
    status: flat.status || undefined,
    clientId: flat.clientId || undefined,
    country: flat.country || undefined,
    keyword: flat.keyword || undefined,
    sort: flat.sort || undefined,
    order: flat.order || undefined,
    page,
    pageSize,
  });
  const params: InboundSearchParams = parsed.success ? parsed.data : { page, pageSize };

  const [session, inbounds, exportResult, wmsLinksResult] = await Promise.all([
    getSession(),
    getInbounds(params),
    getInbounds({ ...params, page: 1, pageSize: EXPORT_MAX_ROWS }),
    getWmsLinks({ pageSize: 100 }),
  ]);

  const wmsLinkOptions: SelectOption[] = wmsLinksResult.items.map((link) => ({
    value: link.id,
    label: link.name,
  }));

  return (
    // lg 이상: 셸이 준 높이를 그대로 채워 목록이 화면 안에 들어오고, 표 안에서만 스크롤된다.
    // lg 미만: 검색 조건이 여러 줄로 감겨 표에 남는 높이가 얇아지므로 페이지 전체 스크롤로 둔다.
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <PageHeader
        title="입고현황"
        description="입고 목록을 조회하고 입고상태(예정 → 대기 → 입고) 진행을 추적합니다."
        className="shrink-0"
      />

      {/* 이 화면의 검색 조건 = WMS LINK · 시작일 · 종료일 · 기준일자 · 입고상태 · 검색어.
       * SearchPanel은 옵션을 넘긴 필터만 렌더링하므로, 클라이언트·국가 옵션은 넘기지 않는다
       * (검색 조건은 화면마다 다르다 — 사용자 확정). 서버 스코핑은 그대로 lib/data가 담당한다. */}
      <SearchPanel
        basePath="/inbound"
        role={session.role}
        wmsLinkOptions={wmsLinkOptions}
        dateFieldOptions={DATE_FIELD_OPTIONS}
        // 기준일자 바로 옆에 입고상태 select가 놓인다(SearchPanel의 필드 순서)
        statusOptions={STATUS_OPTIONS}
        statusLabel="입고상태"
        keywordPlaceholder="주문번호 · 접수번호 · SKU 검색"
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
