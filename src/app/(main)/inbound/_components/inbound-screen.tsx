"use client";

import { useState, useTransition } from "react";
import { SearchPanel, type SearchPanelValues, type SelectOption } from "@/components/common/search-panel";
import {
  INBOUND_DATE_FIELD,
  INBOUND_DATE_FIELD_LABEL,
  INBOUND_STATUS_FILTER,
  INBOUND_STATUS_LABEL,
  inboundSearchParamsSchema,
  type Inbound,
  type InboundSearchParams,
  type Paginated,
  type UserRole,
} from "@/types";
import { searchInbounds } from "../actions";
import { InboundTable } from "./inbound-table";
import { InboundDownloadButton } from "./inbound-download-button";

// 기준일자 후보 = Req의 searchDt 코드(입고접수일 REQ_DT · 창고도착일 WRHS_DT · 입고완료일 CMPL_DT).
// 입고완료일은 응답에 표시할 필드가 없어 목록 컬럼에는 없다(검색 기준으로만 존재 — TBD 참조).
const DATE_FIELD_OPTIONS: SelectOption[] = INBOUND_DATE_FIELD.map((field) => ({
  value: field,
  label: INBOUND_DATE_FIELD_LABEL[field],
}));

// 입고상태 필터 옵션 — Req의 status enum(PLAN/STANDBY/WORK/COMPLETED/CANCELED)과 1:1.
// UNKNOW는 응답 전용 값이라 필터에 없다. 표시명은 INBOUND_STATUS_LABEL 그대로(라벨 임의 변경 금지).
const STATUS_OPTIONS: SelectOption[] = INBOUND_STATUS_FILTER.map((status) => ({
  value: status,
  label: INBOUND_STATUS_LABEL[status],
}));

// F012 "검색결과 전체 다운로드"용 상한 — 서버 액션으로 클릭 시점에 조회하는 최대 행 수.
const EXPORT_MAX_ROWS = 1000;

interface InboundScreenProps {
  role: UserRole;
  /** WMS LINK 필터 옵션 — 페이지(서버)가 GET /wmslkmap에서 받아 매핑해 내려준다 */
  wmsLinkOptions: SelectOption[];
  /** 첫 진입 기본 검색 조건(최근 1주 · 1페이지) — 페이지(서버)가 만든 값과 첫 데이터의 조건이 항상 같다 */
  initialParams: InboundSearchParams;
  initialData: Paginated<Inbound>;
}

/**
 * 입고현황의 클라이언트 검색 상태 컨테이너 — 검색 조건을 URL에 싣지 않는다(사용자 확정
 * 2026-08-05, URL은 /inbound 고정). 조건·정렬·페이지는 전부 이 컴포넌트의 상태이고,
 * 변경 시 서버 액션(searchInbounds)으로 재조회한다(레거시 SPA와 같은 동작 — 새로고침하면
 * 기본 조건으로 초기화되고, 조건이 담긴 링크 공유는 지원하지 않는다: 의도된 트레이드오프).
 */
export function InboundScreen({ role, wmsLinkOptions, initialParams, initialData }: InboundScreenProps) {
  const [params, setParams] = useState<InboundSearchParams>(initialParams);
  const [data, setData] = useState<Paginated<Inbound>>(initialData);
  const [isPending, startTransition] = useTransition();

  /** 검색 상태를 바꾸고 서버 액션으로 재조회 — 응답 순서 역전은 transition이 마지막 것만 반영해 무해 */
  function runSearch(next: InboundSearchParams) {
    setParams(next);
    startTransition(async () => {
      setData(await searchInbounds(next));
    });
  }

  // 조회/초기화 — 패널 값은 URL 시절과 동일하게 zod로 좁힌다(enum 밖 값은 필드 단위 무시).
  // 항상 1페이지·기본 페이지 크기부터: URL 모드의 "조회 시 page/pageSize 초기화"와 같은 규칙.
  function handlePanelSearch(values: SearchPanelValues) {
    const parsed = inboundSearchParamsSchema.safeParse({ ...values, page: 1 });
    runSearch(parsed.success ? parsed.data : { page: 1 });
  }

  function fetchExportRows(): Promise<Inbound[]> {
    return searchInbounds({ ...params, page: 1, pageSize: EXPORT_MAX_ROWS }).then((result) => result.items);
  }

  return (
    <>
      {/* 이 화면의 검색 조건 = WMS LINK · 시작일 · 종료일 · 기준일자 · 입고상태 · 검색어.
       * 입고 목록 Req(Swagger 확정)에 클라이언트·국가 파라미터가 없으므로 두 필터는 노출하지
       * 않는 것으로 확정 — 다른 목록 화면은 각자 Swagger 확인 시 결정한다(CLAUDE.md TBD).
       * CLIENT 데이터 격리는 그대로 서버 스코핑(lib/data)이 담당한다. */}
      <SearchPanel
        role={role}
        wmsLinkOptions={wmsLinkOptions}
        dateFieldOptions={DATE_FIELD_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        statusLabel="입고상태"
        keywordPlaceholder="접수번호 · SKU · 상품명 검색"
        defaultValues={initialParams}
        onSearch={handlePanelSearch}
        className="shrink-0"
      />

      <InboundTable
        data={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        sort={params.sort}
        order={params.order}
        loading={isPending}
        onPageChange={(page) => runSearch({ ...params, page, pageSize: data.pageSize })}
        onPageSizeChange={(pageSize) => runSearch({ ...params, pageSize, page: 1 })}
        onSortChange={(key, order) =>
          runSearch({
            ...params,
            sort: order ? key : undefined,
            order: order ?? undefined,
            page: 1,
            pageSize: data.pageSize,
          })
        }
        toolbarActions={<InboundDownloadButton getRows={fetchExportRows} />}
      />
    </>
  );
}
