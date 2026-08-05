"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { SearchPanel, type SearchPanelValues, type SelectOption } from "@/components/common/search-panel";
import { toEpochSeconds } from "@/lib/utils/datetime";
// sortItems는 순수 목록 유틸(데이터 접근 아님) — Req에 정렬 파라미터가 없어 받은 페이지
// 안에서만 재정렬하는 프런트 전용 정렬을 목 경로(lib/data)와 공유한다.
import { sortItems } from "@/lib/data/utils";
import {
  DEFAULT_PAGE_SIZE,
  INBOUND_DATE_FIELD,
  INBOUND_DATE_FIELD_LABEL,
  INBOUND_STATUS_FILTER,
  INBOUND_STATUS_LABEL,
  WMS_LINK_ALL,
  inboundSearchParamsSchema,
  inboundSortValue,
  toDomainInbound,
  wireInboundSchema,
  type Inbound,
  type InboundSearchParams,
  type Paginated,
  type UserRole,
} from "@/types";
import { PageHeader } from "@/components/common/page-header";
import { ListScreenLayout } from "@/components/common/list-screen-layout";
import { ExcelDownloadButton } from "@/components/common/excel-download-button";
import { InboundTable } from "./inbound-table";
import { INBOUND_CSV_COLUMNS } from "./inbound-csv-columns";

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

// F012 "검색결과 전체 다운로드"용 상한 — 클릭 시점에 BFF로 조회하는 최대 행 수.
const EXPORT_MAX_ROWS = 1000;

/**
 * 입고 목록 조회 — axios GET /api/dtin(데이터 BFF). 응답은 Java Res(/dtin) 그대로의
 * **행 배열**이다(사용자 확정 2026-08-05 — devtools 응답 = Res). 표시 전에 공용 변환
 * (wireInboundSchema → toDomainInbound: epoch 초→ms · 0→null · 미확정 status 강등)으로
 * 도메인 행으로 정규화한다. axios가 undefined 필드는 쿼리에서 알아서 뺀다.
 * (서버 액션 금지 — 원칙 7. 스코핑·목 폴백은 BFF 뒤의 lib/data 몫.)
 */
async function fetchInboundRows(params: InboundSearchParams): Promise<Inbound[]> {
  const { data } = await axios.get<unknown[]>("/api/dtin", { params });
  return data.map((raw) => toDomainInbound(wireInboundSchema.parse(raw)));
}

/** 입고 건수 조회 — GET /api/dtin/cnt(숫자 그대로). Req 확정 스펙대로 목록과 동일
 * 필터만 싣고 페이지·정렬 파라미터는 뺀다. */
async function fetchInboundCount(params: InboundSearchParams): Promise<number> {
  const filter = {
    wmsLinkId: params.wmsLinkId,
    startDt: params.startDt,
    endDt: params.endDt,
    searchDt: params.searchDt,
    status: params.status,
    search: params.search,
  };
  const { data } = await axios.get<number>("/api/dtin/cnt", { params: filter });
  return data;
}

interface InboundScreenProps {
  role: UserRole;
  /** WMS LINK 필터 옵션 — 페이지(서버)가 GET /wmslkmap에서 받아 매핑해 내려준다 */
  wmsLinkOptions: SelectOption[];
  /** 기본 기간의 날짜 문자열("YYYY-MM-DD") — 검색 패널 입력 표시용(파라미터는 epoch 초라 별도) */
  initialPeriod: { from: string; to: string };
  /** 첫 진입 기본 검색 조건(최근 1주 · 1페이지, Req 계약) — 페이지(서버)가 만든 값과 첫 데이터의 조건이 항상 같다 */
  initialParams: InboundSearchParams;
  initialData: Paginated<Inbound>;
}
/**
 * 입고현황의 클라이언트 검색 상태 컨테이너 — 검색 조건을 URL에 싣지 않는다(사용자 확정
 * 2026-08-05, URL은 /dtin 고정). 조건·정렬·페이지는 전부 이 컴포넌트의 상태이고,
 * 변경 시 axios로 데이터 BFF(/api/dtin)를 재조회한다(레거시 SPA와 같은 동작 —
 * 새로고침하면 기본 조건으로 초기화되고, 조건이 담긴 링크 공유는 지원하지 않는다:
 * 의도된 트레이드오프).
 */
export function InboundScreen({ role, wmsLinkOptions, initialPeriod, initialParams, initialData }: InboundScreenProps) {
  const [params, setParams] = useState<InboundSearchParams>(initialParams);
  const [data, setData] = useState<Paginated<Inbound>>(initialData);
  const [loading, setLoading] = useState(false);
  // 응답 순서 역전 가드 — 마지막으로 시작한 요청만 반영한다(연타·느린 응답 대비, 레거시 관례).
  const requestSeqRef = useRef(0);

  /**
   * 검색 상태를 바꾸고 BFF로 재조회 — 401(세션 만료)은 로그인으로 보낸다.
   * 건수(/cnt)는 레거시 관례대로 **첫 페이지(pageNo 0) 조회에만** 함께 부르고,
   * 페이지 이동 시엔 직전 total을 유지한다(필터가 바뀌는 조회는 항상 pageNo 0이라 안전).
   * 정렬은 Req에 없어(프런트 전용) 받은 페이지 안에서만 재정렬한다.
   */
  function runSearch(next: InboundSearchParams) {
    setParams(next);
    const seq = ++requestSeqRef.current;
    setLoading(true);
    const pageNo = next.pageNo ?? 0;
    Promise.all([fetchInboundRows(next), pageNo === 0 ? fetchInboundCount(next) : Promise.resolve(null)])
      .then(([rows, count]) => {
        if (requestSeqRef.current !== seq) return;
        const items = sortItems(rows, next.sort, next.order, inboundSortValue);
        setData((prev) => ({
          items,
          total: count ?? prev.total,
          page: pageNo + 1,
          pageSize: next.pageSize ?? DEFAULT_PAGE_SIZE,
        }));
      })
      .catch((error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          window.location.href = "/login";
          return;
        }
        console.error("[inbound] GET /api/dtin 실패:", error);
      })
      .finally(() => {
        if (requestSeqRef.current === seq) setLoading(false);
      });
  }

  // 조회/초기화 — 패널 값(UI 계약: dateFrom/dateTo 날짜 문자열·keyword 등)을 Req 계약
  // (startDt/endDt epoch 초 · searchDt · search)으로 변환한 뒤 zod로 좁힌다(어긋난 필드만 무시).
  // 항상 첫 페이지(pageNo 0)·기본 페이지 크기부터: 기존 "조회 시 페이지 초기화" 규칙 유지.
  function handlePanelSearch(values: SearchPanelValues) {
    const parsed = inboundSearchParamsSchema.safeParse({
      // 전체(미선택)도 Req와 동일하게 -100을 항상 싣는다 — 빼면 Java가 조용히 0건을 준다.
      wmsLinkId: values.wmsLinkId ?? String(WMS_LINK_ALL),
      startDt: values.dateFrom ? toEpochSeconds(values.dateFrom, false) : undefined,
      endDt: values.dateTo ? toEpochSeconds(values.dateTo, true) : undefined,
      searchDt: values.dateField,
      status: values.status,
      search: values.keyword,
      pageNo: 0,
    });
    runSearch(parsed.success ? parsed.data : { pageNo: 0 });
  }

  /** 헤더의 "검색결과 전체 다운로드"(F012) — 클릭 시점의 현재 검색 조건으로 조회한다 */
  function fetchExportRows(): Promise<Inbound[]> {
    return fetchInboundRows({ ...params, pageNo: 0, pageSize: EXPORT_MAX_ROWS });
  }

  return (
    // 높이 채움(h-full min-h-0)·헤더/검색 고정(shrink-0)·표 안 스크롤 골격은
    // 공용 ListScreenLayout이 강제한다 — fillHeight 계약 설명도 그쪽 참조.
    <ListScreenLayout
      header={
        // 페이지 헤더를 여기(클라이언트)서 렌더하는 이유: actions의 엑셀다운로드 버튼이
        // 현재 검색 조건(이 컴포넌트의 상태)으로 조회해야 하는데, 서버 컴포넌트(page.tsx)는
        // 함수 prop을 클라이언트로 넘길 수 없다(RSC 경계 + 서버 액션 금지 — 원칙 7).
        <PageHeader
          title="입고현황"
          // 홈(REVE-ON)은 PageHeader가 항상 붙인다 — 현재 페이지라 href는 주지 않는다
          breadcrumbs={[{ label: "입고현황" }]}
          actions={
            <ExcelDownloadButton
              // 클릭 시점에 현재 검색 조건으로 조회하는 비동기 모드(getRows) — F012.
              getRows={fetchExportRows}
              columns={INBOUND_CSV_COLUMNS}
              filename="inbound-export"
              label="엑셀다운로드"
              // h-auto p-0: 링크형 버튼의 기본 상하 패딩을 없애 박스를 글자 높이에 맞춘다 —
              // 페이지 헤더(items-end)에서 타이틀 밑선과 버튼 글자가 같은 하단선에 붙게(패딩이
              // 있으면 박스 바닥만 맞고 글자는 떠 보인다).
              className="h-auto p-0"
            />
          }
        />
      }
      search={
        // 이 화면의 검색 조건 = WMS LINK · 시작일 · 종료일 · 기준일자 · 입고상태 · 검색어.
        // 입고 목록 Req(Swagger 확정)에 클라이언트·국가 파라미터가 없으므로 두 필터는 노출하지
        // 않는 것으로 확정 — 다른 목록 화면은 각자 Swagger 확인 시 결정한다(CLAUDE.md TBD).
        // CLIENT 데이터 격리는 그대로 서버 스코핑(lib/data)이 담당한다.
        <SearchPanel
          role={role}
          wmsLinkOptions={wmsLinkOptions}
          dateFieldOptions={DATE_FIELD_OPTIONS}
          statusOptions={STATUS_OPTIONS}
          statusLabel="입고상태"
          keywordPlaceholder="접수번호 · SKU · 상품명 검색"
          // 패널 표시용 초기값 — 파라미터(epoch 초)와 별도로 날짜 문자열을 준다(같은 기간).
          defaultValues={{ dateFrom: initialPeriod.from, dateTo: initialPeriod.to }}
          onSearch={handlePanelSearch}
        />
      }
    >
      <InboundTable
        data={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        sort={params.sort}
        order={params.order}
        loading={loading}
        // DataTable의 page는 1-기반(표기용), 파라미터 계약은 Req와 같은 pageNo(0-기반) — 여기서 변환.
        onPageChange={(page) => runSearch({ ...params, pageNo: page - 1, pageSize: data.pageSize })}
        onPageSizeChange={(pageSize) => runSearch({ ...params, pageSize, pageNo: 0 })}
        onSortChange={(key, order) =>
          runSearch({
            ...params,
            sort: order ? key : undefined,
            order: order ?? undefined,
            pageNo: 0,
            pageSize: data.pageSize,
          })
        }
        // 엑셀다운로드는 페이지 헤더 actions로 이동(사용자 확정 2026-08-05) — 표 툴바에는 없음.
      />
    </ListScreenLayout>
  );
}
