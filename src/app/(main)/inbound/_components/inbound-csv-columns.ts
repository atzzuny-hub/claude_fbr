import type { ExcelDownloadColumn } from "@/components/common/excel-download-button";
import { formatDateTime } from "@/lib/utils/datetime";
import { COUNTRY_LABEL, INBOUND_STATUS_LABEL, type Inbound } from "@/types";

/**
 * 입고 CSV 컬럼 — "검색결과 전체 다운로드"(InboundDownloadButton)와 행 단위 다운로드
 * (InboundTable의 rowActions)가 같은 정의를 공유해 두 파일의 열이 어긋나지 않게 한다.
 *
 * 화면 컬럼(주문번호·접수번호·입고상태·국가·WMS LINK·3개 날짜)에 더해, 목록에서 빼고
 * 행 상세로 옮긴 클라이언트·SKU·수량도 담는다 — 파일에는 열 폭 제약이 없다.
 */
export const INBOUND_CSV_COLUMNS: ExcelDownloadColumn<Inbound>[] = [
  { header: "주문번호", accessor: (row) => row.orderNo },
  { header: "접수번호", accessor: (row) => row.receiptNo },
  { header: "입고상태", accessor: (row) => INBOUND_STATUS_LABEL[row.status] },
  { header: "국가", accessor: (row) => COUNTRY_LABEL[row.country] },
  { header: "WMS LINK", accessor: (row) => row.wmsLinkName },
  // 화면과 같은 "YYYY-MM-DD HH:mm" 표기 — 미도착/미완료는 빈칸(파일에서는 "-"보다 빈칸이 낫다)
  { header: "입고접수일", accessor: (row) => formatDateTime(row.receiptDate, "") },
  { header: "창고도착일", accessor: (row) => formatDateTime(row.arrivalDate, "") },
  { header: "입고 완료일", accessor: (row) => formatDateTime(row.completedDate, "") },
  { header: "클라이언트", accessor: (row) => row.clientName },
  { header: "고객명", accessor: (row) => row.customerName },
  { header: "연락처", accessor: (row) => row.customerContact },
  // 대표 상품(첫 라인)과 총 입고수량 — 라인 상세는 화면 행 확장에서 확인.
  { header: "대표상품 SKU", accessor: (row) => row.skuCode },
  { header: "대표상품명", accessor: (row) => row.skuName },
  { header: "총 입고수량", accessor: (row) => row.quantity },
];
