"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import {
  StickyDetailFootTd,
  StickyDetailTd,
  StickyDetailTh,
} from "@/components/common/sticky-detail-table";
import { StatusBadge } from "@/components/common/status-badge";
import { CountryCell } from "@/components/common/country-flag";
import { DateTimeCell } from "@/components/common/date-time-cell";
import { RowExportButton } from "@/components/common/excel-download-button";
import { cn } from "@/lib/utils";
import { INBOUND_STATUS_LABEL, type Inbound, type InboundStatus } from "@/types";
import { INBOUND_CSV_COLUMNS } from "./inbound-csv-columns";
import { InboundDetailDialog } from "./inbound-detail-dialog";

/**
 * StatusBadge tone 매핑 — 예정(info)→대기(warning)→작업중(info)→입고(success), StatusBadge
 * 권장 매핑을 따른다(작업중은 "진행 중" 의미라 예정과 같은 파랑 계열).
 * 취소는 파이프라인 밖 종료 상태라 붉은 톤(destructive), 알 수 없음(UNKNOW — 원본 코드 매핑
 * 실패)은 중립 톤으로 조용히 표시한다.
 */
const INBOUND_STATUS_TONE: Record<InboundStatus, "info" | "warning" | "success" | "destructive" | "neutral"> = {
  PLAN: "info",
  STANDBY: "warning",
  WORK: "info",
  COMPLETED: "success",
  CANCELED: "destructive",
  UNKNOW: "neutral",
};

/** 접수번호 등 nullable 문자열 셀 — 값이 없으면 조용한 대시로 표시한다 */
function nullableCell(value: string | null) {
  return value ?? <span className="text-tertiary-foreground">—</span>;
}

interface InboundTableProps {
  data: Inbound[];
  total: number;
  page: number;
  pageSize: number;
  /** 현재 정렬 상태 — 부모(InboundScreen)의 검색 상태에서 내려온다(URL에 싣지 않는다) */
  sort?: string;
  order?: "asc" | "desc";
  /** 재조회 중 표시 — DataTable loading으로 전달(조회·페이지 이동 등 서버 액션 진행 중) */
  loading?: boolean;
  /** 페이지/페이지크기/정렬 변경 → 부모가 서버 액션으로 재조회한다(URL 불변) */
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (key: string, order: "asc" | "desc" | null) => void;
  /** 표 상단 툴바에 놓을 액션(예: 검색결과 다운로드 버튼) */
  toolbarActions?: React.ReactNode;
}

/**
 * DataTable을 /dtin(입고현황) 화면에 배선하는 얇은 래퍼 — 컬럼 정의·행 상세·행 다운로드 담당.
 * 페이지네이션·정렬은 콜백으로 부모(InboundScreen)에 위임한다: 검색 조건을 URL에 싣지
 * 않는 화면이라(사용자 확정 2026-08-05) 여기서 내비게이션하지 않는다.
 */
export function InboundTable({
  data,
  total,
  page,
  pageSize,
  sort,
  order,
  loading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  toolbarActions,
}: InboundTableProps) {
  /*
   * 행 클릭 상세 팝업 — 목록이 이미 받아 둔 행을 그대로 넘긴다(추가 조회 없음).
   * detailRow를 open과 따로 두는 이유: 닫히는 애니메이션 동안에도 내용이 남아 있어야 한다
   * (row를 즉시 비우면 사라지는 중에 빈 팝업이 한 프레임 보인다).
   */
  const [detailRow, setDetailRow] = useState<Inbound | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 컬럼 8개 — Swagger 응답 필드 기준(주문번호=ganNo · 접수번호=dataId, 날짜는 3종 —
  // 배송일(sipDt)은 사용자 확정으로 제외).
  // 여기서 빠진 클라이언트·제품·수량은 행 확장(+) 상세와 CSV로 옮겼다.
  const columns: DataTableColumn<Inbound>[] = [
    { key: "ganNo", header: "주문번호", cell: (row) => nullableCell(row.ganNo), cellClassName: "font-mono" },
    { key: "dataId", header: "접수번호", cell: (row) => nullableCell(row.dataId), cellClassName: "font-mono" },
    {
      key: "status",
      header: "입고상태",
      cell: (row) => (
        <StatusBadge label={INBOUND_STATUS_LABEL[row.status]} tone={INBOUND_STATUS_TONE[row.status]} />
      ),
    },
    { key: "country", header: "국가", cell: (row) => <CountryCell country={row.cntyCd} /> },
    { key: "wmsLink", header: "WMS LINK", cell: (row) => row.wmsLinkName },
    // 세 날짜는 시각까지 표시한다(DateTimeCell: 날짜 위 · 시각 아래, epoch ms → UTC 표기).
    // 아직 일어나지 않은 단계(미도착)는 값이 없어 "-"만 나온다.
    { key: "reqDt", header: "입고접수일", cell: (row) => <DateTimeCell value={row.reqDt} /> },
    { key: "arvDt", header: "창고도착일", cell: (row) => <DateTimeCell value={row.arvDt} /> },
    // 입고 정보 변경일이 들어가있음. 이거 나중에 확인해서 알맞는 값으로 고쳐
    { key: "etaDt", header: "입고완료일", cell: (row) => <DateTimeCell value={row.dataUpdDt} /> },
  ];

  return (
    <>
      <DataTable
        // 목록은 화면 높이 안에 들어가고, 행이 많으면 표 안에서만 스크롤된다(헤더 고정·페이지네이션 상시 노출).
        // 부모(page.tsx)가 높이 정해진 flex 컬럼이어야 동작한다.
        fillHeight
        // 헤더 우측 경계 드래그로 컬럼 너비 조절, 헤더 셀 드래그로 열 순서 변경 —
        // 조절값(너비·순서)은 persistKey로 브라우저에 저장·복원
        resizableColumns
        reorderableColumns
        persistKey="inbound"
        // 표 상단 툴바(열 너비 초기화 옆)에 검색결과 다운로드 버튼을 놓는다
        toolbarActions={toolbarActions}
        columns={columns}
        data={data}
        getRowId={(row) => String(row.idx)}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        // 헤더 클릭 정렬 — 오름→내림→해제 순환. 해제(null)를 포함해 부모가 검색 상태를
        // 갱신하고 서버 액션으로 재조회한다(항상 첫 페이지로 — 부모 핸들러 몫).
        sort={sort}
        order={order}
        onSortChange={onSortChange}
        // 행 확장(+) 상세 — 고객명·연락처 + 입고 상품 리스트(합계 포함).
        // 입고상태 파이프라인은 추후 상세화면으로 이동 예정이라 여기서는 제외한다.
        renderDetail={(row) => <InboundDetail row={row} />}
        // 행 상세 엑셀의 서버 다운로드 전환(INBOUND_API.downloadRow = /dtin/dn/{idx})은
        // Phase 2에 공용 RowExportButton 쪽에서 교체한다.
        rowActions={(row) => (
          <RowExportButton
            row={row}
            columns={INBOUND_CSV_COLUMNS}
            filename={`inbound-${row.ganNo ?? row.idx}`}
          />
        )}
        // 행 클릭 → 입고 상세 팝업(F001 "입고 목록/상세 조회").
        // 행 앞 조작 칸(펼치기 · 행 다운로드) 클릭은 전달되지 않는다.
        onRowClick={(row) => {
          setDetailRow(row);
          setDetailOpen(true);
        }}
      />
      <InboundDetailDialog row={detailRow} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

/**
 * 행 확장(+) 상세 — 고객명·연락처와 제품 목록(SKU LIST, 합계 포함).
 * 수량 3종은 Swagger 의미 그대로: expQty(접수) ⊇ qty(사용 가능) + excQty(오류).
 * 넓은 표는 자체 컨테이너에서 가로 스크롤한다(페이지 본문은 가로로 넘치지 않게).
 */
function InboundDetail({ row }: { row: Inbound }) {
  const totalInbound = row.prodList.reduce((sum, prod) => sum + prod.expQty, 0);
  const totalAvailable = row.prodList.reduce((sum, prod) => sum + prod.qty, 0);
  const totalError = row.prodList.reduce((sum, prod) => sum + prod.excQty, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 고객명 · 연락처 — nullable 필드는 대시로.
       * 클라이언트·입고 ID는 사용자 확정(2026-08-05)으로 여기서 제외 — 행 클릭 상세 팝업에서 확인. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-xs">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">고객명</span>
          <span className="font-medium text-foreground">{row.contactName ?? "—"}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">연락처</span>
          <span className="font-medium tabular-nums text-foreground">{row.contactTel ?? "—"}</span>
        </span>
      </div>

      {/* 제품 목록(SKU LIST) */}
      <div className="flex flex-col gap-2">
        <div className="text-xs text-tertiary-foreground">
          제품 목록 ({row.prodList.length}종) · 전체 {row.prodQty.toLocaleString()}개
        </div>
        {/* 넓은 표는 가로 스크롤, 제품이 5종을 넘으면 세로도 이 박스 안에서만 스크롤
         * (행 확장이 화면을 통째로 밀어내지 않게). 스크롤 중 헤더·합계(tfoot) 고정과
         * 배경·경계선 트릭은 공용 StickyDetail* 셀(components/common/sticky-detail-table) 몫. */}
        <div
          className={cn(
            "overflow-x-auto",
            row.prodList.length > 5 && "max-h-60 overflow-y-auto overscroll-contain",
          )}
        >
          <table className="w-full min-w-160 border-collapse text-xs">
            <thead>
              <tr className="text-tertiary-foreground">
                <StickyDetailTh>SKU</StickyDetailTh>
                <StickyDetailTh className="text-right">입고 전체 수량</StickyDetailTh>
                <StickyDetailTh className="text-right">사용가능수량</StickyDetailTh>
                <StickyDetailTh className="text-right">오류수량</StickyDetailTh>
                <StickyDetailTh>단위</StickyDetailTh>
                <StickyDetailTh>상품명</StickyDetailTh>
              </tr>
            </thead>
            <tbody>
              {row.prodList.map((prod, index) => (
                <tr key={`${prod.sku}-${index}`} className="border-b border-border/60">
                  <StickyDetailTd className="font-mono">{prod.sku}</StickyDetailTd>
                  <StickyDetailTd className="text-right font-mono font-medium tabular-nums">
                    {prod.expQty.toLocaleString()}
                  </StickyDetailTd>
                  <StickyDetailTd className="text-right font-mono tabular-nums">
                    {prod.qty.toLocaleString()}
                  </StickyDetailTd>
                  <StickyDetailTd className="text-right font-mono tabular-nums text-muted-foreground">
                    {prod.excQty.toLocaleString()}
                  </StickyDetailTd>
                  <StickyDetailTd>{prod.unit}</StickyDetailTd>
                  <StickyDetailTd>{prod.productName}</StickyDetailTd>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium text-foreground">
                <StickyDetailFootTd>합계</StickyDetailFootTd>
                <StickyDetailFootTd className="text-right font-mono tabular-nums">
                  {totalInbound.toLocaleString()}
                </StickyDetailFootTd>
                <StickyDetailFootTd className="text-right font-mono tabular-nums">
                  {totalAvailable.toLocaleString()}
                </StickyDetailFootTd>
                <StickyDetailFootTd className="text-right font-mono tabular-nums">
                  {totalError.toLocaleString()}
                </StickyDetailFootTd>
                <StickyDetailFootTd />
                <StickyDetailFootTd />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

