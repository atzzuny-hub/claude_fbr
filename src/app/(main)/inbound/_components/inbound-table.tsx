"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { CountryCell } from "@/components/common/country-flag";
import { DateTimeCell } from "@/components/common/date-time-cell";
import { exportRowsToCsv } from "@/components/common/excel-download-button";
import { mergeSearchParams } from "@/lib/utils/search-params";
import { cn } from "@/lib/utils";
import { INBOUND_STATUS_LABEL, type Inbound, type InboundStatus } from "@/types";
import { INBOUND_CSV_COLUMNS } from "./inbound-csv-columns";

/**
 * StatusBadge tone 매핑 — 예정(info)→대기(warning)→입고(success), StatusBadge 권장 매핑을 따른다.
 * 취소는 파이프라인 밖 종료 상태라 붉은 톤(destructive)으로 표시한다.
 */
const INBOUND_STATUS_TONE: Record<InboundStatus, "info" | "warning" | "success" | "destructive"> = {
  SCHEDULED: "info",
  WAITING: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

interface InboundTableProps {
  data: Inbound[];
  total: number;
  page: number;
  pageSize: number;
  /** 부모(서버 컴포넌트)가 이미 읽은 현재 필터값 — 페이지/페이지크기만 바꿀 때 나머지를 보존한다 */
  currentQuery: Record<string, string>;
  /** 표 상단 툴바에 놓을 액션(예: 검색결과 다운로드 버튼) — page.tsx가 전체 검색결과로 렌더해 넘긴다 */
  toolbarActions?: React.ReactNode;
}

/**
 * DataTable을 /inbound 화면에 배선하는 얇은 클라이언트 래퍼.
 * DataTable/ExcelDownloadButton처럼 함수 props를 받는 컴포넌트는 서버 컴포넌트(page.tsx)에서
 * 직접 사용할 수 없어(RSC 경계) 이 래퍼를 거친다.
 */
export function InboundTable({ data, total, page, pageSize, currentQuery, toolbarActions }: InboundTableProps) {
  const router = useRouter();

  function navigate(updates: Record<string, string | number | undefined>) {
    const qs = mergeSearchParams(new URLSearchParams(currentQuery), updates);
    router.push(qs ? `/inbound?${qs}` : "/inbound");
  }

  // 현재 정렬 상태 — URL 쿼리에서 읽는다(order는 asc/desc만 인정).
  const sort = currentQuery.sort || undefined;
  const order = currentQuery.order === "desc" ? "desc" : currentQuery.order === "asc" ? "asc" : undefined;

  // 컬럼 구성은 사용자 확정 8개. 여기서 빠진 클라이언트·SKU·수량은 행 확장(+) 상세로 옮겼다.
  const columns: DataTableColumn<Inbound>[] = [
    { key: "orderNo", header: "주문번호", cell: (row) => row.orderNo, cellClassName: "font-mono" },
    {
      key: "receiptNo",
      header: "접수번호",
      cell: (row) => row.receiptNo,
      cellClassName: "font-mono",
    },
    {
      key: "status",
      header: "입고상태",
      cell: (row) => (
        <StatusBadge label={INBOUND_STATUS_LABEL[row.status]} tone={INBOUND_STATUS_TONE[row.status]} />
      ),
    },
    { key: "country", header: "국가", cell: (row) => <CountryCell country={row.country} /> },
    { key: "wmsLink", header: "WMS LINK", cell: (row) => row.wmsLinkName },
    // 세 날짜는 시각까지 표시한다(DateTimeCell: 날짜 위 · 시각 아래).
    // 아직 도착/완료 전인 행은 값이 없어 "-"만 나온다.
    { key: "receiptDate", header: "입고접수일", cell: (row) => <DateTimeCell value={row.receiptDate} /> },
    { key: "arrivalDate", header: "창고도착일", cell: (row) => <DateTimeCell value={row.arrivalDate} /> },
    {
      key: "completedDate",
      header: "입고 완료일",
      cell: (row) => <DateTimeCell value={row.completedDate} />,
    },
  ];

  return (
    <DataTable
      // 목록은 화면 높이 안에 들어가고, 행이 많으면 표 안에서만 스크롤된다(헤더 고정·페이지네이션 상시 노출).
      // 부모(page.tsx)가 높이 정해진 flex 컬럼이어야 동작한다.
      fillHeight
      // 헤더 우측 경계를 드래그해 컬럼 너비 조절 가능 — 조절값은 persistKey로 브라우저에 저장·복원
      resizableColumns
      persistKey="inbound"
      // 표 상단 툴바(열 너비 초기화 옆)에 검색결과 다운로드 버튼을 놓는다
      toolbarActions={toolbarActions}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={(nextPage) => navigate({ page: nextPage })}
      onPageSizeChange={(nextPageSize) => navigate({ pageSize: nextPageSize, page: 1 })}
      // 헤더 클릭 정렬 — URL 쿼리(sort/order)로 서버 정렬. 오름→내림→해제 순환.
      // 해제(nextOrder=null)면 sort/order를 URL에서 지운다(기본 순서로 복귀). 항상 첫 페이지로.
      sort={sort}
      order={order}
      onSortChange={(key, nextOrder) =>
        navigate({
          sort: nextOrder ? key : undefined,
          order: nextOrder ?? undefined,
          page: 1,
        })
      }
      // 행 확장(+) 상세 — 고객명·연락처 + 입고 상품 리스트(합계 포함).
      // 입고상태 파이프라인은 추후 상세화면으로 이동 예정이라 여기서는 제외한다.
      renderDetail={(row) => <InboundDetail row={row} />}
      rowActions={(row) => (
        <Button
          variant="info-soft"
          size="icon-xs"
          aria-label="이 행 다운로드"
          onClick={() =>
            exportRowsToCsv([row], INBOUND_CSV_COLUMNS, `inbound-${row.receiptNo}`)
          }
        >
          <Download />
        </Button>
      )}
    />
  );
}

/**
 * 행 확장(+) 상세 — 고객명·연락처와 입고 상품 리스트(합계 포함).
 * 넓은 표는 자체 컨테이너에서 가로 스크롤한다(페이지 본문은 가로로 넘치지 않게).
 */
function InboundDetail({ row }: { row: Inbound }) {
  const totalQuantity = row.lines.reduce((sum, line) => sum + line.totalQuantity, 0);
  const totalAvailable = row.lines.reduce((sum, line) => sum + line.availableQuantity, 0);
  const totalError = row.lines.reduce((sum, line) => sum + (line.errorQuantity ?? 0), 0);
  const hasAnyError = row.lines.some((line) => line.errorQuantity != null);

  return (
    <div className="flex flex-col gap-4">
      {/* 고객명 · 연락처 */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-xs">
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">고객명</span>
          <span className="font-medium text-foreground">{row.customerName}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">연락처</span>
          <span className="font-medium tabular-nums text-foreground">{row.customerContact}</span>
        </span>
      </div>

      {/* 상품 리스트 */}
      <div className="flex flex-col gap-2">
        <div className="text-xs text-tertiary-foreground">
          상품 리스트 ({row.lines.length}) · {row.lines.length}종 {totalQuantity.toLocaleString()}개
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-tertiary-foreground">
                <DetailTh>SKU</DetailTh>
                <DetailTh className="text-right">입고 전체수량</DetailTh>
                <DetailTh className="text-right">사용가능수량</DetailTh>
                <DetailTh className="text-right">오류수량</DetailTh>
                <DetailTh>단위</DetailTh>
                <DetailTh>상품명</DetailTh>
                <DetailTh>상품명(한글)</DetailTh>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/60">
                  <DetailTd className="font-mono">{line.skuCode}</DetailTd>
                  <DetailTd className="text-right font-mono font-medium tabular-nums">
                    {line.totalQuantity.toLocaleString()}
                  </DetailTd>
                  <DetailTd className="text-right font-mono tabular-nums">
                    {line.availableQuantity.toLocaleString()}
                  </DetailTd>
                  <DetailTd className="text-right font-mono tabular-nums text-muted-foreground">
                    {line.errorQuantity == null ? "—" : line.errorQuantity.toLocaleString()}
                  </DetailTd>
                  <DetailTd>{line.unit}</DetailTd>
                  <DetailTd>{line.productName}</DetailTd>
                  <DetailTd>{line.productNameKo}</DetailTd>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium text-foreground">
                <DetailTd>합계</DetailTd>
                <DetailTd className="text-right font-mono tabular-nums">
                  {totalQuantity.toLocaleString()}
                </DetailTd>
                <DetailTd className="text-right font-mono tabular-nums">
                  {totalAvailable.toLocaleString()}
                </DetailTd>
                <DetailTd className="text-right font-mono tabular-nums">
                  {hasAnyError ? totalError.toLocaleString() : "—"}
                </DetailTd>
                <DetailTd />
                <DetailTd />
                <DetailTd />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function DetailTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-left font-medium whitespace-nowrap", className)}>{children}</th>;
}

function DetailTd({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 text-left whitespace-nowrap", className)}>{children}</td>;
}
