// PRD: F001(입고현황 조회), F012(목록 검색·엑셀 다운로드), F013(역할별 데이터 스코핑)
// — 입고현황 페이지 (접근 권한: 공통·데이터 스코핑, 로그인 후 기본 진입 화면)
import { getClients, getInbounds, getSession, getWmsLinks } from "@/lib/data";
import {
  COUNTRY,
  COUNTRY_LABEL,
  INBOUND_STATUS,
  INBOUND_STATUS_LABEL,
  inboundSearchParamsSchema,
  type InboundSearchParams,
} from "@/types";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { PageHeader } from "@/components/common/page-header";
import { SearchPanel, type ClientFilterOption, type SelectOption } from "@/components/common/search-panel";
import { InboundTable } from "./_components/inbound-table";
import { InboundDownloadButton } from "./_components/inbound-download-button";

const DATE_FIELD_OPTIONS: SelectOption[] = [
  { value: "expectedDate", label: "입고예정일" },
  { value: "receivedDate", label: "입고일" },
  { value: "createdAt", label: "등록일" },
];

const STATUS_OPTIONS: SelectOption[] = INBOUND_STATUS.map((status) => ({
  value: status,
  label: INBOUND_STATUS_LABEL[status],
}));

// (운영자 전용) 국가 필터 — F013: 운영자는 클라이언트·국가·WMS LINK 필터 제공
const COUNTRY_OPTIONS: SelectOption[] = COUNTRY.map((country) => ({
  value: country,
  label: COUNTRY_LABEL[country],
}));

// F012 "검색결과 전체 다운로드"용 상한 — 현재 목데이터 규모(64건) 대비 충분히 큰 값.
const EXPORT_MAX_ROWS = 1000;

interface InboundPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InboundPage({ searchParams }: InboundPageProps) {
  const flat = flattenSearchParams(await searchParams);
  const page = Number(flat.page) > 0 ? Number(flat.page) : 1;
  const pageSize = Number(flat.pageSize) > 0 ? Number(flat.pageSize) : 20;

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
    page,
    pageSize,
  });
  const params: InboundSearchParams = parsed.success ? parsed.data : { page, pageSize };

  const [session, inbounds, exportResult, wmsLinksResult, clientsResult] = await Promise.all([
    getSession(),
    getInbounds(params),
    getInbounds({ ...params, page: 1, pageSize: EXPORT_MAX_ROWS }),
    getWmsLinks({ pageSize: 100 }),
    getClients({ pageSize: 200 }),
  ]);

  const wmsLinkOptions: SelectOption[] = wmsLinksResult.items.map((link) => ({
    value: link.id,
    label: link.name,
  }));
  // OPERATOR에게만 SearchPanel이 실제로 렌더링하는 옵션(CLIENT는 세션 clientId로 자동 스코핑).
  const clientOptions: ClientFilterOption[] = clientsResult.items.map((client) => ({
    value: client.id,
    label: client.name,
    wmsLinkId: client.wmsLinkId,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="입고현황"
        description="입고 목록을 조회하고 입고상태(예정 → 대기 → 입고) 진행을 추적합니다."
        actions={<InboundDownloadButton data={exportResult.items} />}
      />

      <SearchPanel
        basePath="/inbound"
        role={session.role}
        wmsLinkOptions={wmsLinkOptions}
        dateFieldOptions={DATE_FIELD_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        clientOptions={clientOptions}
        countryOptions={COUNTRY_OPTIONS}
        keywordPlaceholder="참조번호 · SKU명 · 클라이언트명 검색"
        defaultValues={params}
      />

      <InboundTable
        data={inbounds.items}
        total={inbounds.total}
        page={inbounds.page}
        pageSize={inbounds.pageSize}
        currentQuery={flat}
      />
    </div>
  );
}
