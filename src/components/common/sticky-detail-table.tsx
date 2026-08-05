import { cn } from "@/lib/utils";

/*
 * 세로 스크롤되는 라인아이템 표(행 확장 상세·상세 팝업의 제품 목록 등)의 공용 셀 —
 * 스크롤 중에도 헤더(Th)는 위, 합계(FootTd)는 바닥에 sticky로 고정된다.
 * sticky는 thead/tr 대신 각 셀에 걸어야 브라우저 간 동작이 일정하고(DataTable과 동일 방식),
 * border-collapse에서는 sticky 셀의 border가 같이 밀려 올라가므로 경계선은 inset shadow로
 * 그린다. 표 자체(<table>·컬럼 구성·합계 유무)는 각 화면이 직접 구성하고 셀만 가져다 쓴다.
 * 패딩·정렬 기본값(px-3 py-2 · text-left)은 className으로 덮어쓸 수 있다(cn = tailwind-merge).
 */

/** sticky 셀의 불투명 배경 — 확장 패널(bg-row-alt 틴트)과 같아 보이도록 카드색 위에
 * 틴트를 겹친다(다크 모드 틴트가 반투명이라 밑 행이 비치는 것 방지). */
export const STICKY_DETAIL_BG =
  "bg-card bg-[linear-gradient(var(--color-row-alt),var(--color-row-alt))]";

interface StickyDetailCellProps {
  children?: React.ReactNode;
  className?: string;
}

/** 헤더 셀 — 세로 스크롤 중에도 상단에 고정. 밑줄은 sticky에서도 따라오게 inset shadow로. */
export function StickyDetailTh({ children, className }: StickyDetailCellProps) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 px-3 py-2 text-left font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]",
        STICKY_DETAIL_BG,
        className,
      )}
    >
      {children}
    </th>
  );
}

/** 본문 셀 — sticky 아님. 헤더·합계와 같은 패딩·정렬 기본값을 공유하려고 여기 함께 둔다. */
export function StickyDetailTd({ children, className }: StickyDetailCellProps) {
  return <td className={cn("px-3 py-2 text-left whitespace-nowrap", className)}>{children}</td>;
}

/** 합계(tfoot) 셀 — 세로 스크롤 중에도 바닥에 고정. 윗줄은 sticky에서도 따라오게 inset shadow로. */
export function StickyDetailFootTd({ children, className }: StickyDetailCellProps) {
  return (
    <td
      className={cn(
        "sticky bottom-0 z-10 px-3 py-2 text-left whitespace-nowrap shadow-[inset_0_1px_0_0_var(--color-border)]",
        STICKY_DETAIL_BG,
        className,
      )}
    >
      {children}
    </td>
  );
}
