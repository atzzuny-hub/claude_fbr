"use client";

import { CountryCell } from "@/components/common/country-flag";
import { DataTable, DataTableColumn } from "@/components/common/data-table";
import { DateTimeCell } from "@/components/common/date-time-cell";
import { NullableCell } from "@/components/common/nullable-cell";
import { StatusBadge } from "@/components/common/status-badge";
import {  Outbound, OUTBOUND_DELIVERY_LABEL, OUTBOUND_STATUS_LABEL, OutboundDelivery, OutboundStatus } from "@/types";

interface InboundTableProps {
  data: Outbound[];
  total: number;
  page: number;
  pageSize: number;
}

const OUTBOUND_STATUS_TONE: Record<OutboundStatus, "info" | "warning" | "success" | "destructive" | "neutral"> = {
  PEND: "info",
  PICK: "warning",
  PACK: "info",
  COMPLETED: "success",
  CANCELED: "destructive",
  HOLDED:"info",
  RETURNED:"info",
  P_RETURNED:"info",
  UNKNOW: "neutral",
};

const OUTBOUND_DELIVERY_TONE: Record<OutboundDelivery, "info" | "warning" | "success" | "destructive" | "neutral"> = {
  DELIVERING: "info",
  DELIVERED: "info",
  COMPLETED: "success",
  RETURNED: "destructive",
  UNKNOW: "neutral",
};


const columns: DataTableColumn<Outbound>[] = [
    { key: "ganNo", header: "주문번호", cell: (row) => <NullableCell value={row.ganNo} />, cellClassName: "font-mono" },
    { key: "dataId", header: "접수번호", cell: (row) => <NullableCell value={row.dataId} />, cellClassName: "font-mono" },
    { key: "marketName", header: "채널", cell: (row) => <NullableCell value={row.marketName} />, cellClassName: "font-mono" },
    {
        key: "status",
        header: "출고상태",
        cell: (row) => (
        <StatusBadge label={OUTBOUND_STATUS_LABEL[row.status]} tone={OUTBOUND_STATUS_TONE[row.status]} />
        ),
    },
    {
        key: "delivery",
        header: "배송상태",
        // delivery는 nullable(배송 단계 전이면 값 없음) — null이면 배지 대신 "—"로 표시.
        cell: (row) =>
            row.delivery === null ? (
                <NullableCell value={null} />
            ) : (
                <StatusBadge label={OUTBOUND_DELIVERY_LABEL[row.delivery]} tone={OUTBOUND_DELIVERY_TONE[row.delivery]} />
            ),
    },
    { key: "totalAmount", header: "총 금액", cell: (row) => <NullableCell value={row.totalAmount} />, cellClassName: "font-mono" },
    { key: "wmsLinkName", header: "WMS Link", cell: (row) => <NullableCell value={row.wmsLinkName} />, cellClassName: "font-mono" },
    { key: "country", header: "국가", cell: (row) => <CountryCell country={row.cntyCd} /> },
    { key: "orderDt", header: "주문일", cell: (row) => <DateTimeCell value={row.orderDt} /> },
    { key: "releaseDt", header: "출고상태변경일", cell: (row) => <DateTimeCell value={row.releaseDt} /> },
    { key: "deliveryDt", header: "배송일", cell: (row) => <DateTimeCell value={row.deliveryDt} /> },
    { key: "businessType", header: "비지니스타입", cell: (row) => <NullableCell value={row.businessType} />, cellClassName: "font-mono" },
    { key: "dataRegDt", header: "출고 등록일", cell: (row) => <DateTimeCell value={row.dataRegDt} /> },
]


export function OutboundTable({data, total, page, pageSize}:InboundTableProps){
    return (
        <>
            <DataTable
                fillHeight
                resizableColumns
                reorderableColumns
                persistKey="outbound"
                columns={columns}
                data={data}
                renderDetail={(row) => <OutboundDetail row={row} />}
                getRowId={(row) => String(row.idx)}
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={()=>{}}
            />
        </>
    )
}


function OutboundDetail({row}:{row:Outbound}){
    return(
        <div>
            {row.receiver?.addr}
        </div>
    )
}



