"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { StatusStepper } from "@/components/common/status-stepper";
import { CountryCell } from "@/components/common/country-flag";
import { DateTimeCell } from "@/components/common/date-time-cell";
import { exportRowsToCsv } from "@/components/common/excel-download-button";
import { mergeSearchParams } from "@/lib/utils/search-params";
import { formatDate } from "@/lib/utils/datetime";
import { COUNTRY_LABEL, INBOUND_STATUS, INBOUND_STATUS_LABEL, type Inbound, type InboundStatus } from "@/types";
import { INBOUND_CSV_COLUMNS } from "./inbound-csv-columns";

/** StatusBadge tone 매핑 — 예정(info)→대기(warning)→입고(success), StatusBadge 문서의 권장 매핑을 따른다 */
const INBOUND_STATUS_TONE: Record<InboundStatus, "info" | "warning" | "success"> = {
  SCHEDULED: "info",
  WAITING: "warning",
  RECEIVED: "success",
};

interface InboundTableProps {
  data: Inbound[];
  total: number;
  page: number;
  pageSize: number;
  /** 부모(서버 컴포넌트)가 이미 읽은 현재 필터값 — 페이지/페이지크기만 바꿀 때 나머지를 보존한다 */
  currentQuery: Record<string, string>;
}

/**
 * DataTable을 /inbound 화면에 배선하는 얇은 클라이언트 래퍼.
 * DataTable/ExcelDownloadButton처럼 함수 props를 받는 컴포넌트는 서버 컴포넌트(page.tsx)에서
 * 직접 사용할 수 없어(RSC 경계) 이 래퍼를 거친다.
 */
export function InboundTable({ data, total, page, pageSize, currentQuery }: InboundTableProps) {
  const router = useRouter();

  function navigate(updates: Record<string, string | number | undefined>) {
    const qs = mergeSearchParams(new URLSearchParams(currentQuery), updates);
    router.push(qs ? `/inbound?${qs}` : "/inbound");
  }

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
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={(nextPage) => navigate({ page: nextPage })}
      onPageSizeChange={(nextPageSize) => navigate({ pageSize: nextPageSize, page: 1 })}
      renderDetail={(row) => (
        <div className="flex flex-col gap-4">
          <StatusStepper
            steps={INBOUND_STATUS.map((status) => ({ key: status, label: INBOUND_STATUS_LABEL[status] }))}
            currentKey={row.status}
            className="max-w-md"
          />
          {/* 목록 컬럼에서 뺀 클라이언트·SKU·수량을 여기서 보여준다 */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            <DetailItem label="클라이언트" value={row.clientName} />
            <DetailItem label="SKU" value={`${row.skuCode} · ${row.skuName}`} />
            <DetailItem label="수량" value={row.quantity.toLocaleString()} />
            <DetailItem label="국가" value={COUNTRY_LABEL[row.country]} />
            <DetailItem label="등록일" value={formatDate(row.createdAt)} />
            <DetailItem label="최근 수정" value={formatDate(row.updatedAt)} />
          </dl>
        </div>
      )}
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
