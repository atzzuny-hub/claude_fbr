import type { ExcelDownloadColumn } from "@/components/common/excel-download-button";
import { formatEpochDateTime } from "@/lib/utils/datetime";
import { countryLabel, INBOUND_STATUS_LABEL, type Inbound } from "@/types";

/**
 * 입고 CSV 컬럼 — "검색결과 전체 다운로드"(InboundDownloadButton)와 행 단위 다운로드
 * (InboundTable의 rowActions)가 같은 정의를 공유해 두 파일의 열이 어긋나지 않게 한다.
 *
 * 화면 컬럼(접수번호·입고상태·국가·WMS LINK·3개 날짜)에 더해, 목록에서 빼고
 * 행 상세로 옮긴 클라이언트·고객·대표상품·수량도 담는다 — 파일에는 열 폭 제약이 없다.
 * nullable 필드는 빈칸으로 둔다(파일에서는 "-"보다 빈칸이 낫다).
 */
export const INBOUND_CSV_COLUMNS: ExcelDownloadColumn<Inbound>[] = [
  { header: "접수번호", accessor: (row) => row.ganNo ?? "" },
  { header: "입고상태", accessor: (row) => INBOUND_STATUS_LABEL[row.status] },
  { header: "상태 원본 코드", accessor: (row) => row.statusOriginalCode ?? "" },
  { header: "국가", accessor: (row) => countryLabel(row.cntyCd) },
  { header: "WMS LINK", accessor: (row) => row.wmsLinkName },
  // 화면과 같은 "YYYY-MM-DD HH:mm"(UTC) 표기 — 아직 없는 단계는 빈칸
  { header: "입고접수일", accessor: (row) => formatEpochDateTime(row.reqDt, "") },
  { header: "도착예정일", accessor: (row) => formatEpochDateTime(row.etaDt, "") },
  { header: "창고도착일", accessor: (row) => formatEpochDateTime(row.arvDt, "") },
  { header: "클라이언트", accessor: (row) => row.clntName ?? "" },
  { header: "고객명", accessor: (row) => row.contactName ?? "" },
  { header: "연락처", accessor: (row) => row.contactTel ?? "" },
  { header: "입고 ID", accessor: (row) => row.dataId },
  // 대표 상품(첫 제품)과 전체 수량 — 제품별 상세는 화면 행 확장에서 확인.
  { header: "대표상품 SKU", accessor: (row) => row.prodList[0]?.sku ?? "" },
  { header: "대표상품명", accessor: (row) => row.prodList[0]?.productName ?? "" },
  { header: "제품 전체 수량", accessor: (row) => row.prodQty },
];
