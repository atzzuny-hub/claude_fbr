"use client";

import { ExcelDownloadButton } from "@/components/common/excel-download-button";
import { INBOUND_STATUS_LABEL, type Inbound } from "@/types";

/**
 * ExcelDownloadButton의 columns는 accessor 함수를 포함하므로 Server Component(page.tsx)에서
 * 직접 넘길 수 없다(함수는 RSC 경계를 건널 수 없음). data(직렬화 가능)만 서버에서 받고,
 * columns 정의는 이 클라이언트 컴포넌트 내부에 둔다 — 화면 조립 단계도 동일 패턴을 따르면 된다.
 */
export function DemoInboundDownloadButton({ data }: { data: Inbound[] }) {
  return (
    <ExcelDownloadButton
      data={data}
      columns={[
        { header: "접수번호", accessor: (row) => row.receiptNo },
        { header: "클라이언트", accessor: (row) => row.clientName },
        { header: "SKU", accessor: (row) => row.skuName },
        { header: "수량", accessor: (row) => row.quantity },
        { header: "상태", accessor: (row) => INBOUND_STATUS_LABEL[row.status] },
      ]}
      filename="inbound-demo"
      label="현재 페이지 다운로드"
    />
  );
}
