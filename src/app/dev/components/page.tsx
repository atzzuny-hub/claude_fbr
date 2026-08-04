import { getClients, getInbounds, getWmsLinks, requireSession } from "@/lib/data";
import {
  CLIENT_STATUS_LABEL,
  INBOUND_DATE_FIELD,
  INBOUND_DATE_FIELD_LABEL,
  INBOUND_STATUS,
  INBOUND_STATUS_FILTER,
  INBOUND_STATUS_FLOW,
  INBOUND_STATUS_LABEL,
  WMS_REQUEST_STATUS,
  WMS_REQUEST_STATUS_LABEL,
  type InboundSearchParams,
  type InboundStatus,
} from "@/types";
import { flattenSearchParams } from "@/lib/utils/search-params";
import { PageHeader } from "@/components/common/page-header";
import { SearchPanel, type ClientFilterOption, type SelectOption } from "@/components/common/search-panel";
import { StatusBadge } from "@/components/common/status-badge";
import { StatusStepper } from "@/components/common/status-stepper";
import { DemoInboundTable } from "./demo-inbound-table";
import { DemoInboundDownloadButton } from "./demo-inbound-download-button";

// 기준일자 = 입고 목록 Req의 searchDt 코드(Swagger 확정 스키마와 1:1)
const DATE_FIELD_OPTIONS: SelectOption[] = INBOUND_DATE_FIELD.map((field) => ({
  value: field,
  label: INBOUND_DATE_FIELD_LABEL[field],
}));

// 상태 필터 = Req의 status enum(UNKNOW는 응답 전용이라 제외)
const STATUS_OPTIONS: SelectOption[] = INBOUND_STATUS_FILTER.map((status) => ({
  value: status,
  label: INBOUND_STATUS_LABEL[status],
}));

const INBOUND_STATUS_TONE: Record<InboundStatus, "info" | "warning" | "success" | "destructive" | "neutral"> = {
  PLAN: "info",
  STANDBY: "warning",
  COMPLETED: "success",
  CANCELED: "destructive",
  UNKNOW: "neutral",
};

interface DevComponentsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * 공통 부품(디자인 시스템) 데모 페이지 — 개발 확인용이며 실제 메뉴 화면이 아니다.
 * 입고(Inbound) 목데이터로 SearchPanel/DataTable/StatusStepper/StatusBadge/
 * ExcelDownloadButton이 실제 도메인 타입·lib/data와 맞물려 동작하는지 확인한다.
 *
 * 세션은 실 로그인(httpOnly 쿠키) 기준(2026-08-04 전환) — 비로그인 접근은 /login으로
 * 리디렉션되고, 역할(OPERATOR/CLIENT)은 로그인 계정의 auth 레벨을 따른다.
 * 역할별 화면 비교는 권한이 다른 계정으로 각각 로그인해 확인한다.
 */
export default async function DevComponentsPage({ searchParams }: DevComponentsPageProps) {
  const flat = flattenSearchParams(await searchParams);
  const page = Number(flat.page) > 0 ? Number(flat.page) : 1;
  const pageSize = Number(flat.pageSize) > 0 ? Number(flat.pageSize) : 10;

  const params: InboundSearchParams = {
    dateFrom: flat.dateFrom,
    dateTo: flat.dateTo,
    // 실 화면에서는 zod로 런타임 검증 후 좁히는 것을 권장 — 데모 페이지는 단순 캐스팅으로 축약.
    dateField: flat.dateField as InboundSearchParams["dateField"],
    wmsLinkId: flat.wmsLinkId,
    status: flat.status as InboundSearchParams["status"],
    keyword: flat.keyword,
    page,
    pageSize,
  };

  const [session, inbounds, wmsLinksResult, clientsResult] = await Promise.all([
    requireSession(),
    getInbounds(params),
    getWmsLinks({ pageSize: 100 }),
    getClients({ pageSize: 200 }),
  ]);

  // 필터 옵션 value = 입고 행이 참조하는 수치 ID(idx) — 실제 화면(/inbound)과 같은 기준.
  const wmsLinkOptions: SelectOption[] = wmsLinksResult.items.map((link) => ({
    value: String(link.idx),
    label: link.name,
  }));
  // 클라이언트 select는 SearchPanel의 계층 필터(WMS → 클라이언트 좁히기) UI 데모용 —
  // 입고 목록 Req에는 클라이언트 파라미터가 없어 실제 조회에는 쓰이지 않는다.
  const wmsIdxById = new Map(wmsLinksResult.items.map((link) => [link.id, String(link.idx)]));
  const clientOptions: ClientFilterOption[] = clientsResult.items.map((client) => ({
    value: client.id,
    label: client.name,
    wmsLinkId: wmsIdxById.get(client.wmsLinkId) ?? client.wmsLinkId,
  }));

  return (
    <div className="flex flex-col gap-10 pb-16">
      <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700">
        개발 확인용 데모 페이지입니다 — 실제 메뉴 화면(/inbound 등)이 아니며, 공통 부품 동작 확인
        목적으로만 사용합니다.
      </div>

      <PageHeader
        title="공통 컴포넌트 데모"
        description="SearchPanel · DataTable · StatusStepper · StatusBadge · ExcelDownloadButton을 입고(Inbound) 목데이터로 확인합니다."
        count={inbounds.total}
        actions={<DemoInboundDownloadButton data={inbounds.items} />}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">SearchPanel</h2>
        {/* 데모 페이지는 지원하는 필터를 전부 켜 둔다 — 실제 화면은 필요한 옵션만 넘겨
         * 자기 검색 조건을 구성한다(예: /inbound = WMS LINK·시작일·종료일·기준일자·검색어) */}
        <SearchPanel
          basePath="/dev/components"
          role={session.role}
          wmsLinkOptions={wmsLinkOptions}
          dateFieldOptions={DATE_FIELD_OPTIONS}
          statusOptions={STATUS_OPTIONS}
          clientOptions={clientOptions}
          keywordPlaceholder="참조번호 · SKU명 · 클라이언트명 검색"
          defaultValues={params}
        />
        <p className="text-xs text-muted-foreground">
          현재 세션 role: <span className="font-mono font-semibold text-foreground">{session.role}</span> (
          {session.name} · {session.email}) — 로그인 계정의 auth 레벨에서 결정됩니다(LV1=운영자).
          CLIENT 계정으로 로그인하면 클라이언트 select가 사라지고 메뉴도 공통 6개로 줄어듭니다.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">DataTable</h2>
        <DemoInboundTable
          data={inbounds.items}
          total={inbounds.total}
          page={inbounds.page}
          pageSize={inbounds.pageSize}
          currentQuery={flat}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">StatusStepper</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(30,20,80,0.06)]">
            <p className="mb-4 text-xs font-medium text-tertiary-foreground">
              입고 — 예정 → 대기 → 입고
            </p>
            <StatusStepper
              steps={INBOUND_STATUS_FLOW.map((status) => ({ key: status, label: INBOUND_STATUS_LABEL[status] }))}
              currentKey="STANDBY"
            />
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(30,20,80,0.06)]">
            <p className="mb-4 text-xs font-medium text-tertiary-foreground">
              입고 — 취소(파이프라인 밖 종료 상태)
            </p>
            <StatusStepper
              steps={INBOUND_STATUS_FLOW.map((status) => ({ key: status, label: INBOUND_STATUS_LABEL[status] }))}
              currentKey="CANCELED"
              terminal={{ label: INBOUND_STATUS_LABEL.CANCELED }}
            />
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(30,20,80,0.06)]">
            <p className="mb-4 text-xs font-medium text-tertiary-foreground">
              NEW 요청 — 제출됨 → WMS 등록 대기 → 등록 완료
            </p>
            <StatusStepper
              steps={WMS_REQUEST_STATUS.map((status) => ({
                key: status,
                label: WMS_REQUEST_STATUS_LABEL[status],
              }))}
              currentKey="PENDING_WMS"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">StatusBadge</h2>
        <div className="flex flex-wrap gap-2">
          {INBOUND_STATUS.map((status) => (
            <StatusBadge
              key={status}
              label={INBOUND_STATUS_LABEL[status]}
              tone={INBOUND_STATUS_TONE[status]}
            />
          ))}
          <StatusBadge label={CLIENT_STATUS_LABEL.ACTIVE} tone="success" />
          <StatusBadge label={CLIENT_STATUS_LABEL.INACTIVE} tone="destructive" />
          <StatusBadge label="예시 — 기본" tone="neutral" />
        </div>
      </section>
    </div>
  );
}
