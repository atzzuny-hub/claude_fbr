"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { StatusStepper } from "@/components/common/status-stepper";
import { exportRowsToCsv } from "@/components/common/excel-download-button";
import { mergeSearchParams } from "@/lib/utils/search-params";
import { INBOUND_STATUS, INBOUND_STATUS_LABEL, type Inbound, type InboundStatus } from "@/types";

const STATUS_TONE: Record<InboundStatus, "info" | "warning" | "success"> = {
  SCHEDULED: "info",
  WAITING: "warning",
  RECEIVED: "success",
};

interface DemoInboundTableProps {
  data: Inbound[];
  total: number;
  page: number;
  pageSize: number;
  /** 부모(서버 컴포넌트)가 이미 읽은 현재 필터값 — 페이지/페이지크기만 바꿀 때 나머지를 보존한다 */
  currentQuery: Record<string, string>;
}

/**
 * DataTable을 실제 화면에 배선하는 방법을 보여주는 데모용 얇은 클라이언트 래퍼.
 * 화면 조립(screen-builder) 단계에서 각 메뉴 화면도 이와 같은 형태
 * (서버 컴포넌트 page.tsx → 얇은 클라이언트 래퍼 → DataTable)를 따르면 된다.
 */
export function DemoInboundTable({ data, total, page, pageSize, currentQuery }: DemoInboundTableProps) {
  const router = useRouter();

  function navigate(updates: Record<string, string | number | undefined>) {
    const qs = mergeSearchParams(new URLSearchParams(currentQuery), updates);
    router.push(qs ? `/dev/components?${qs}` : "/dev/components");
  }

  const columns: DataTableColumn<Inbound>[] = [
    { key: "referenceNo", header: "참조번호", cell: (row) => row.referenceNo },
    { key: "client", header: "클라이언트", cell: (row) => row.clientName },
    { key: "sku", header: "SKU", cell: (row) => `${row.skuCode} · ${row.skuName}` },
    { key: "wmsLink", header: "WMS LINK", cell: (row) => row.wmsLinkName },
    {
      key: "quantity",
      header: "수량",
      cell: (row) => row.quantity.toLocaleString(),
      numeric: true,
    },
    {
      key: "status",
      header: "상태",
      cell: (row) => (
        <StatusBadge label={INBOUND_STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
      ),
    },
    { key: "expectedDate", header: "입고예정일", cell: (row) => row.expectedDate },
  ];

  return (
    <DataTable
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
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            <DetailItem label="국가" value={row.country} />
            <DetailItem label="입고일" value={row.receivedDate ?? "-"} />
            <DetailItem label="등록일" value={row.createdAt.slice(0, 10)} />
            <DetailItem label="최근 수정" value={row.updatedAt.slice(0, 10)} />
          </dl>
        </div>
      )}
      rowActions={(row) => (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="이 행 다운로드"
          onClick={() =>
            exportRowsToCsv(
              [row],
              [
                { header: "참조번호", accessor: (r) => r.referenceNo },
                { header: "SKU", accessor: (r) => r.skuName },
                { header: "수량", accessor: (r) => r.quantity },
                { header: "상태", accessor: (r) => INBOUND_STATUS_LABEL[r.status] },
              ],
              `inbound-${row.referenceNo}`,
            )
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
