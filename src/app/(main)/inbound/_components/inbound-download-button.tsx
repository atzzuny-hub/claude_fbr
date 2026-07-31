"use client";

import { ExcelDownloadButton } from "@/components/common/excel-download-button";
import { COUNTRY_LABEL, INBOUND_STATUS_LABEL, type Inbound } from "@/types";

/**
 * ExcelDownloadButton의 columns는 accessor 함수를 포함하므로 서버 컴포넌트(page.tsx)에서
 * 직접 넘길 수 없다(함수는 RSC 경계를 건널 수 없음). data(직렬화 가능)만 서버에서 받고,
 * columns 정의는 이 클라이언트 컴포넌트 내부에 둔다.
 *
 * data는 page.tsx가 현재 검색 조건으로 별도 조회한 "검색결과 전체"(페이지네이션 미적용)를
 * 전달한다 — F012 "검색결과 전체 다운로드" 요구사항 대응.
 */
export function InboundDownloadButton({ data }: { data: Inbound[] }) {
  return (
    <ExcelDownloadButton
      data={data}
      columns={[
        { header: "참조번호", accessor: (row) => row.referenceNo },
        { header: "클라이언트", accessor: (row) => row.clientName },
        { header: "국가", accessor: (row) => COUNTRY_LABEL[row.country] },
        { header: "WMS LINK", accessor: (row) => row.wmsLinkName },
        { header: "SKU 코드", accessor: (row) => row.skuCode },
        { header: "SKU명", accessor: (row) => row.skuName },
        { header: "수량", accessor: (row) => row.quantity },
        { header: "상태", accessor: (row) => INBOUND_STATUS_LABEL[row.status] },
        { header: "입고예정일", accessor: (row) => row.expectedDate },
        { header: "입고일", accessor: (row) => row.receivedDate ?? "" },
      ]}
      filename="inbound-export"
      label="검색결과 다운로드"
    />
  );
}
