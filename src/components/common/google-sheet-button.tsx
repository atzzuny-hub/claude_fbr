"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXCEL_BUTTON_TONE } from "@/components/common/excel-download-button";
import { cn } from "@/lib/utils";

interface GoogleSheetButtonProps {
  /**
   * 시트 생성 BFF 엔드포인트(GET, 응답 `{ url }`) — 현재 검색 조건 쿼리까지 호출부가 조립해
   * 준다(예: `/api/dtin/dn/sheet?…필터`). 서버가 엑셀을 시트로 변환 업로드하고 URL을 돌려준다.
   */
  endpoint: string;
  label?: string;
  busyLabel?: string;
  className?: string;
}

/**
 * "구글 시트로 열기" 버튼 — 클릭하면 BFF가 검색결과 엑셀을 구글 시트로 만들어 새 탭에 연다.
 * 엑셀 계열 액션이라 EXCEL_BUTTON_TONE을 공유한다(같은 데이터의 다른 출력 형태).
 *
 * 새 탭은 클릭 시점(동기)에 미리 열어 둔다 — 비동기 응답 후 window.open을 부르면 브라우저
 * 팝업 차단에 걸린다. 생성이 끝나면 그 탭을 시트 URL로 보내고, 실패하면 탭을 닫는다.
 */
export function GoogleSheetButton({
  endpoint,
  label = "구글 시트로 열기",
  busyLabel = "시트 생성 중…",
  className,
}: GoogleSheetButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const res = await fetch(endpoint);
      if (res.status === 401) {
        tab?.close();
        window.location.href = "/login";
        return;
      }
      const json: unknown = await res.json().catch(() => null);
      const url = (json as { url?: unknown } | null)?.url;
      if (!res.ok || typeof url !== "string" || !url) {
        tab?.close();
        throw new Error(`구글 시트 생성 실패: HTTP ${res.status}`);
      }
      if (tab) {
        tab.location.href = url;
      } else {
        // 사전 탭 열기가 차단된 경우 — 사용자 제스처와 멀어졌지만 한 번 더 시도한다.
        window.open(url, "_blank");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="link"
      className={cn(EXCEL_BUTTON_TONE, className)}
      disabled={busy}
      onClick={handleClick}
    >
      <FileSpreadsheet data-icon="inline-end" />
      {busy ? busyLabel : label}
    </Button>
  );
}
