"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXCEL_BUTTON_TONE, exportRowsToCsv } from "@/components/common/excel-download-button";
import type { Inbound } from "@/types";
import { INBOUND_CSV_COLUMNS } from "./inbound-csv-columns";

/**
 * 검색결과 전체 다운로드(F012) — 클릭 시점에 현재 검색 조건의 전체 결과(페이지네이션
 * 미적용)를 부모가 준 getRows(서버 액션 경유)로 조회해 CSV로 저장한다.
 * 예전처럼 페이지를 그릴 때마다 전체 결과를 미리 받아두지 않는다 — 실데이터 전환 후
 * 매 조회 2중 호출(목록 + 전체) 비용을 없애고, 누르는 순간의 조건으로 뽑는다.
 *
 * Phase 2 교체 지점: 서버 제공 엑셀 다운로드 엔드포인트가 확정되어 있다
 * (lib/api/inbound.ts INBOUND_API.download = /dtin/dn) — getRows→CSV 생성 대신
 * BFF 경유 파일 다운로드로 교체한다(이 컴포넌트 내부만 바뀐다).
 */
export function InboundDownloadButton({ getRows }: { getRows: () => Promise<Inbound[]> }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      exportRowsToCsv(await getRows(), INBOUND_CSV_COLUMNS, "inbound-export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="link"
      className={EXCEL_BUTTON_TONE}
      disabled={busy}
      onClick={handleClick}
    >
      <Download data-icon="inline-end" />
      {busy ? "다운로드 중…" : "엑셀다운로드"}
    </Button>
  );
}
