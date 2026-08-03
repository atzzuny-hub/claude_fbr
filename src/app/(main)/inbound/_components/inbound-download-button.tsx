"use client";

import { ExcelDownloadButton } from "@/components/common/excel-download-button";
import type { Inbound } from "@/types";
import { INBOUND_CSV_COLUMNS } from "./inbound-csv-columns";

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
      columns={INBOUND_CSV_COLUMNS}
      filename="inbound-export"
      label="엑셀다운로드"
    />
  );
}
